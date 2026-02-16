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
const { updateQuestionGenStats } = require("../ai/selfTuningCostEngine");
const {
  computeFastStartCounts,
  computeMaxBackfillAttempts,
  fetchExistingQuestionState,
  resolveSourceFileName,
  queueQuestionBackfillJob,
  generateAndPersistBatch,
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
          message: "Question generation is already in progress for this section.",
        });
      }

      // Count existing questions first. If we already have enough, return instantly.
      const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId });
      const {
        targetCount,
        existingCount,
        missingCount,
        immediateCount,
      } = computeFastStartCounts(count, existingState.count);

      if (existingCount >= targetCount) {
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
          backgroundQueued: false,
          remainingCount: 0,
          targetCount,
          durationMs: Date.now() - t0,
          message: "Existing questions reused.",
        });
      }

      // Mark question generation as in progress (for retry scenario)
      await sectionRef.update({
        questionsStatus: "GENERATING",
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      const sourceFileName = await resolveSourceFileName(uid, section.fileId);
      const immediateTargetCount = existingCount + immediateCount;
      const immediateBatch = await generateAndPersistBatch({
        uid,
        courseId,
        sectionId,
        section,
        sourceFileName,
        existingCount,
        existingStems: existingState.stems,
        targetCount: immediateTargetCount,
      });

      if (!immediateBatch.success) {
        const hasExisting = existingCount > 0;
        await sectionRef.update({
          questionsStatus: hasExisting ? "COMPLETED" : "FAILED",
          questionsCount: existingCount,
          questionsErrorMessage: hasExisting ?
            "Some questions are available, but generating more failed. Try again shortly." :
            immediateBatch.error || "Question generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          activeQuestionJobId: admin.firestore.FieldValue.delete(),
        });
        if (!hasExisting) return fail(Errors.AI_FAILED);
        return ok({
          questionCount: existingCount,
          generatedNow: 0,
          skippedCount: 0,
          backgroundQueued: false,
          remainingCount: Math.max(0, targetCount - existingCount),
          targetCount,
          durationMs: Date.now() - t0,
          message: "Using existing questions. Failed to generate additional questions right now.",
        });
      }

      const readyCount = existingCount + immediateBatch.generatedNow;
      const questionGenStats = updateQuestionGenStats(section.questionGenStats, {
        aiRequestCount: immediateBatch.aiRequestCount,
        validProduced: immediateBatch.generatedNow,
        duplicateSkipped: immediateBatch.duplicateStemSkipped,
        latencyMs: immediateBatch.durationMs,
        tokenBudget: immediateBatch.tokenBudget,
      });

      const remainingCount = Math.max(0, targetCount - readyCount);
      const backgroundQueued = remainingCount > 0;
      const sectionUpdate = {
        questionsStatus: backgroundQueued ? "GENERATING" : "COMPLETED",
        questionsCount: readyCount,
        lastQuestionsDurationMs: Date.now() - t0,
        questionGenStats,
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      };
      let backfillJobId = null;
      if (backgroundQueued) {
        backfillJobId = await queueQuestionBackfillJob({
          uid,
          courseId,
          sectionId,
          targetCount,
          attempt: 1,
          maxAttempts: computeMaxBackfillAttempts(targetCount),
        });
        sectionUpdate.activeQuestionJobId = backfillJobId;
      } else {
        sectionUpdate.activeQuestionJobId = admin.firestore.FieldValue.delete();
      }
      await sectionRef.update(sectionUpdate);

      log.info("Questions generated (fast start)", {
        uid,
        courseId,
        sectionId,
        requested: targetCount,
        existingCount,
        missingCount,
        immediateCount,
        generatedNow: immediateBatch.generatedNow,
        readyCount,
        remainingCount,
        backgroundQueued,
        aiRequestCount: immediateBatch.aiRequestCount,
        predictedYield: immediateBatch.predictedYield,
        duplicateStemSkipped: immediateBatch.duplicateStemSkipped,
        skipped: immediateBatch.skippedCount,
        durationMs: Date.now() - t0,
      });

      return ok({
        questionCount: readyCount,
        generatedNow: immediateBatch.generatedNow,
        skippedCount: immediateBatch.skippedCount,
        aiRequestCount: immediateBatch.aiRequestCount,
        predictedYield: immediateBatch.predictedYield,
        distribution: immediateBatch.distribution,
        estimatedSavingsPercent: immediateBatch.estimatedSavingsPercent,
        durationMs: Date.now() - t0,
        backgroundQueued,
        remainingCount,
        targetCount,
        readyNow: readyCount,
        jobId: backfillJobId,
        message: backgroundQueued
          ? `Generated ${readyCount} questions now. Continuing ${remainingCount} in the background.`
          : "Question generation complete.",
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
