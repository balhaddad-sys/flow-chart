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
const { generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

exports.generateQuestions = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
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

      // ── Fetch section text ──────────────────────────────────────────────
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(section.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      // ── Difficulty distribution ─────────────────────────────────────────
      const easyCount = Math.round(count * DIFFICULTY_DISTRIBUTION.easy);
      const hardCount = Math.round(count * DIFFICULTY_DISTRIBUTION.hard);
      const mediumCount = count - easyCount - hardCount;

      // ── AI generation ───────────────────────────────────────────────────
      const result = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({ blueprintJSON: section.blueprint, sectionText, count, easyCount, mediumCount, hardCount })
      );

      if (!result.success || !result.data.questions) return fail(Errors.AI_FAILED);

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

      log.info("Questions generated", { uid, courseId, sectionId, generated: validItems.length, skipped: result.data.questions.length - validItems.length });

      return ok({ questionCount: validItems.length, skippedCount: result.data.questions.length - validItems.length });
    } catch (error) {
      return safeError(error, "question generation");
    }
  });
