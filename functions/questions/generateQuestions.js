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
    const t0 = Date.now();
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "courseId", maxLen: 128 },
      { field: "sectionId", maxLen: 128 },
    ]);
    const count = requireInt(data, "count", 1, 30, 10);

    await checkRateLimit(uid, "generateQuestions", RATE_LIMITS.generateQuestions);

    const { courseId, sectionId } = data;
    const sectionRef = db.doc(`users/${uid}/sections/${sectionId}`);

    try {
      // ── Fetch & validate section ────────────────────────────────────────
      const sectionDoc = await sectionRef.get();
      if (!sectionDoc.exists) return fail(Errors.NOT_FOUND, "Section not found.");

      const section = sectionDoc.data();
      if (section.courseId !== courseId) return fail(Errors.INVALID_ARGUMENT, "Section does not belong to this course.");
      if (!section.blueprint) return fail(Errors.NOT_ANALYZED);

      // Fast-path: if generation is already running, avoid duplicate expensive calls.
      if (section.questionsStatus === "GENERATING") {
        return ok({
          questionCount: section.questionsCount || 0,
          skippedCount: 0,
          inProgress: true,
          message: "Question generation is already in progress for this section.",
        });
      }

      // Count existing questions first. If we already have enough, return instantly.
      const existingSnap = await db
        .collection(`users/${uid}/questions`)
        .where("courseId", "==", courseId)
        .where("sectionId", "==", sectionId)
        .limit(40)
        .get();

      const existingCount = existingSnap.size;
      const existingStems = new Set(
        existingSnap.docs
          .map((doc) => String(doc.data().stem || "").trim().toLowerCase())
          .filter(Boolean)
      );
      if (existingCount >= count) {
        // Keep section metadata in sync for UI responsiveness.
        await sectionRef.set(
          {
            questionsStatus: "COMPLETED",
            questionsCount: existingCount,
            questionsErrorMessage: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
        return ok({
          questionCount: existingCount,
          skippedCount: 0,
          fromCache: true,
          durationMs: Date.now() - t0,
          message: "Existing questions reused.",
        });
      }

      const neededCount = Math.max(1, count - existingCount);
      const fileDoc = section.fileId ? await db.doc(`users/${uid}/files/${section.fileId}`).get() : null;
      const sourceFileName = fileDoc?.exists ? fileDoc.data()?.originalName || "Unknown" : "Unknown";

      // Mark question generation as in progress (for retry scenario)
      await sectionRef.update({
        questionsStatus: "GENERATING",
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      // ── Difficulty distribution ─────────────────────────────────────────
      const easyCount = Math.round(neededCount * DIFFICULTY_DISTRIBUTION.easy);
      const hardCount = Math.round(neededCount * DIFFICULTY_DISTRIBUTION.hard);
      const mediumCount = neededCount - easyCount - hardCount;

      // ── AI generation (using blueprint only, no section text needed) ────
      const result = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({
          blueprintJSON: section.blueprint,
          count: neededCount,
          easyCount,
          mediumCount,
          hardCount,
          sectionTitle: section.title || "Section",
          sourceFileName,
        }),
        {
          maxTokens: Math.min(3600, Math.max(1400, neededCount * 260)),
          retries: 1,
          rateLimitMaxRetries: 1,
          rateLimitRetryDelayMs: 8000,
        }
      );

      if (!result.success || !result.data.questions) {
        // Mark question generation as failed
        await sectionRef.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: result.error || "Question generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return fail(Errors.AI_FAILED);
      }

      // ── Normalise & persist via serialize module ────────────────────────
      const defaults = {
        fileId: section.fileId,
        fileName: sourceFileName,
        sectionId,
        sectionTitle: section.title,
        topicTags: section.topicTags,
      };
      const validItems = [];
      let duplicateStemSkipped = 0;

      for (const raw of result.data.questions) {
        const normalised = normaliseQuestion(raw, defaults);
        if (!normalised) {
          log.warn("Skipping invalid AI question", { sectionId, stem: raw.stem?.slice(0, 80) });
          continue;
        }

        const stemKey = String(normalised.stem || "").trim().toLowerCase();
        if (stemKey && existingStems.has(stemKey)) {
          duplicateStemSkipped++;
          continue;
        }
        if (stemKey) existingStems.add(stemKey);

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

      const finalCount = existingCount + validItems.length;

      // Mark question generation as complete
      await sectionRef.update({
        questionsStatus: "COMPLETED",
        questionsCount: finalCount,
        lastQuestionsDurationMs: Date.now() - t0,
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      log.info("Questions generated", {
        uid,
        courseId,
        sectionId,
        requested: count,
        existingCount,
        neededCount,
        generated: validItems.length,
        finalCount,
        duplicateStemSkipped,
        skipped: result.data.questions.length - validItems.length,
        durationMs: Date.now() - t0,
      });

      return ok({
        questionCount: finalCount,
        generatedNow: validItems.length,
        skippedCount: result.data.questions.length - validItems.length,
        durationMs: Date.now() - t0,
      });
    } catch (error) {
      // CRITICAL: Roll back questionsStatus to prevent stuck GENERATING state
      try {
        await sectionRef.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: error.message || "Unexpected error during question generation",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          lastQuestionsDurationMs: Date.now() - t0,
        });
      } catch (updateError) {
        log.error("Failed to update section status after error", { uid, sectionId, updateError: updateError.message });
      }
      return safeError(error, "question generation");
    }
  });
