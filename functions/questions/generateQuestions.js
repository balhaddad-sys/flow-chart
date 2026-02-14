/**
 * @module questions/generateQuestions
 * @description Callable function that generates exam-style SBA questions.
 *
 * Uses the {@link module:lib/serialize} module to normalise AI output into
 * the Firestore schema, ensuring the transformation is defined in one place.
 *
 * @param {Object} data
 * @param {string} data.courseId
 * @param {string} data.sectionId
 * @param {number} [data.count=10] - Number of questions to generate (1–30).
 * @returns {{ success: true, data: { questionCount: number, skippedCount: number } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchSet } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { DIFFICULTY_DISTRIBUTION } = require("../lib/constants");
const { normaliseQuestion } = require("../lib/serialize");
const { generateQuestions: aiGenerateQuestions } = require("../ai/geminiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

// Define the secret so the function can access it
const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.generateQuestions = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: [geminiApiKey], // Grant access to the secret
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "courseId", maxLen: 128 },
      { field: "sectionId", maxLen: 128 },
    ]);
    const count = requireInt(data, "count", 1, 30, 10);

    await checkRateLimit(uid, "generateQuestions", RATE_LIMITS.generateQuestions);

    try {
      const { courseId, sectionId } = data;

      // ── Fetch & validate section ────────────────────────────────────────
      const sectionDoc = await db.doc(`users/${uid}/sections/${sectionId}`).get();
      if (!sectionDoc.exists) return fail(Errors.NOT_FOUND, "Section not found.");

      const section = sectionDoc.data();
      if (section.courseId !== courseId) return fail(Errors.INVALID_ARGUMENT, "Section does not belong to this course.");
      if (!section.blueprint) return fail(Errors.NOT_ANALYZED);

      // Mark question generation as in progress (for retry scenario)
      await sectionDoc.ref.update({
        questionsStatus: "GENERATING",
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      // ── Difficulty distribution ─────────────────────────────────────────
      const easyCount = Math.round(count * DIFFICULTY_DISTRIBUTION.easy);
      const hardCount = Math.round(count * DIFFICULTY_DISTRIBUTION.hard);
      const mediumCount = count - easyCount - hardCount;

      // ── AI generation (using blueprint only, no section text needed) ────
      const result = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({ blueprintJSON: section.blueprint, count, easyCount, mediumCount, hardCount })
      );

      if (!result.success || !result.data.questions) {
        // Mark question generation as failed
        await sectionDoc.ref.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: result.error || "Question generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return fail(Errors.AI_FAILED);
      }

      // ── Normalise & persist via serialize module ────────────────────────
      const defaults = { fileId: section.fileId, sectionId, sectionTitle: section.title, topicTags: section.topicTags };
      const validItems = [];

      for (const raw of result.data.questions) {
        const normalised = normaliseQuestion(raw, defaults);
        if (!normalised) {
          log.warn("Skipping invalid AI question", { sectionId, stem: raw.stem?.slice(0, 80) });
          continue;
        }

        validItems.push({
          ref: db.collection(`users/${uid}/questions`).doc(),
          data: {
            courseId,
            sectionId,
            ...normalised,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      }

      await batchSet(validItems);

      // Mark question generation as complete
      await sectionDoc.ref.update({
        questionsStatus: "COMPLETED",
        questionsCount: validItems.length,
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      log.info("Questions generated", { uid, courseId, sectionId, generated: validItems.length, skipped: result.data.questions.length - validItems.length });

      return ok({ questionCount: validItems.length, skippedCount: result.data.questions.length - validItems.length });
    } catch (error) {
      // CRITICAL: Roll back questionsStatus to prevent stuck GENERATING state
      try {
        await sectionDoc.ref.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: error.message || "Unexpected error during question generation",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        log.error("Failed to update section status after error", { uid, sectionId, updateError: updateError.message });
      }
      return safeError(error, "question generation");
    }
  });
