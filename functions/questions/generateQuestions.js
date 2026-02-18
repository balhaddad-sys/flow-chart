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
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const {
  computeFastStartCounts,
  computeMaxBackfillAttempts,
  fetchExistingQuestionState,
  queueQuestionBackfillJob,
} = require("./generationPipeline");

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
          backgroundQueued: true,
          message: "Question generation is already in progress.",
        });
      }

      // Count existing questions first. If we already have enough, return instantly.
      const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId });
      const effectiveCount = existingState.distinctCount || existingState.count;
      const { targetCount, missingCount } = computeFastStartCounts(count, effectiveCount);

      if (effectiveCount >= targetCount) {
        await sectionRef.set(
          {
            questionsStatus: "COMPLETED",
            questionsCount: existingState.count,
            questionsErrorMessage: admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );
        return ok({
          questionCount: existingState.count,
          effectiveQuestionCount: effectiveCount,
          skippedCount: 0,
          fromCache: true,
          backgroundQueued: false,
          remainingCount: 0,
          targetCount,
          durationMs: Date.now() - t0,
          message: "Existing questions reused.",
        });
      }

      // ── Fully async: queue background job, return instantly ────────────
      await sectionRef.update({
        questionsStatus: "GENERATING",
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      const backfillJobId = await queueQuestionBackfillJob({
        uid,
        courseId,
        sectionId,
        targetCount,
        attempt: 1,
        maxAttempts: computeMaxBackfillAttempts(targetCount),
      });

      await sectionRef.update({ activeQuestionJobId: backfillJobId });

      log.info("Questions queued (async)", {
        uid,
        courseId,
        sectionId,
        requested: targetCount,
        existingCount: existingState.count,
        effectiveCount,
        missingCount,
        jobId: backfillJobId,
        durationMs: Date.now() - t0,
      });

      return ok({
        questionCount: existingState.count,
        effectiveQuestionCount: effectiveCount,
        generatedNow: 0,
        skippedCount: 0,
        backgroundQueued: true,
        remainingCount: missingCount,
        targetCount,
        readyNow: existingState.count,
        jobId: backfillJobId,
        durationMs: Date.now() - t0,
        message: `Generating ${missingCount} questions in the background.`,
      });
    } catch (error) {
      // CRITICAL: Roll back questionsStatus to avoid a stuck GENERATING state.
      try {
        let existingCount = 0;
        try {
          const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId, limit: 40 });
          existingCount = existingState.count;
        } catch {
          // Ignore lookup failures and fall back to FAILED.
        }
        await sectionRef.update({
          questionsStatus: existingCount > 0 ? "COMPLETED" : "FAILED",
          questionsCount: existingCount,
          questionsErrorMessage: error.message || "Unexpected error during question generation",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          lastQuestionsDurationMs: Date.now() - t0,
          activeQuestionJobId: admin.firestore.FieldValue.delete(),
        });
      } catch (updateError) {
        log.error("Failed to update section status after error", { uid, sectionId, updateError: updateError.message });
      }
      return safeError(error, "question generation");
    }
  });
