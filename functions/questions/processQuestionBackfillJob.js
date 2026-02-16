/**
 * @module questions/processQuestionBackfillJob
 * @description Firestore-triggered worker for chained background question backfill jobs.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { updateQuestionGenStats } = require("../ai/selfTuningCostEngine");
const log = require("../lib/logger");
const {
  QUESTION_BACKFILL_JOB_TYPE,
  BACKFILL_STEP_COUNT,
  MAX_NO_PROGRESS_STREAK,
  fetchExistingQuestionState,
  resolveSourceFileName,
  queueQuestionBackfillJob,
  generateAndPersistBatch,
} = require("./generationPipeline");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.processQuestionBackfillJob = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: [geminiApiKey],
  })
  .firestore.document("users/{uid}/jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const t0 = Date.now();
    const { uid, jobId } = context.params;
    const job = snap.data() || {};

    if (job.type !== QUESTION_BACKFILL_JOB_TYPE) {
      return null;
    }

    const claimed = await db.runTransaction(async (tx) => {
      const current = await tx.get(snap.ref);
      if (!current.exists) return false;
      const latest = current.data() || {};
      if (latest.status !== "PENDING") return false;
      tx.update(snap.ref, {
        status: "RUNNING",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!claimed) {
      return null;
    }

    const courseId = String(job.courseId || "");
    const sectionId = String(job.sectionId || "");
    const targetCount = Math.max(1, Math.min(30, Number(job.targetCount || 10)));
    const attempt = Math.max(1, Number(job.attempt || 1));
    const maxAttempts = Math.max(attempt, Number(job.maxAttempts || 30));
    const noProgressStreak = Math.max(0, Number(job.noProgressStreak || 0));
    const sectionRef = db.doc(`users/${uid}/sections/${sectionId}`);

    if (!courseId || !sectionId) {
      await snap.ref.update({
        status: "FAILED",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
        error: "Missing required job payload fields.",
      });
      return null;
    }

    try {
      const sectionDoc = await sectionRef.get();
      if (!sectionDoc.exists) {
        await snap.ref.update({
          status: "FAILED",
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
          durationMs: Date.now() - t0,
          error: "Section not found for question backfill.",
        });
        return null;
      }

      const section = sectionDoc.data();
      if (section.courseId !== courseId || !section.blueprint) {
        await snap.ref.update({
          status: "FAILED",
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
          durationMs: Date.now() - t0,
          error: "Section is invalid for question backfill.",
        });
        return null;
      }

      const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId });

      if (existingState.count >= targetCount) {
        await Promise.all([
          sectionRef.update({
            questionsStatus: "COMPLETED",
            questionsCount: existingState.count,
            questionsErrorMessage: admin.firestore.FieldValue.delete(),
            activeQuestionJobId: admin.firestore.FieldValue.delete(),
            lastQuestionsDurationMs: Date.now() - t0,
          }),
          snap.ref.update({
            status: "COMPLETED",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalCount: existingState.count,
            durationMs: Date.now() - t0,
            message: "Target already satisfied.",
          }),
        ]);
        return null;
      }

      if (attempt > maxAttempts || noProgressStreak >= MAX_NO_PROGRESS_STREAK) {
        const fallbackStatus = existingState.count > 0 ? "COMPLETED" : "FAILED";
        await Promise.all([
          sectionRef.update({
            questionsStatus: fallbackStatus,
            questionsCount: existingState.count,
            activeQuestionJobId: admin.firestore.FieldValue.delete(),
            questionsErrorMessage: fallbackStatus === "COMPLETED" ?
              admin.firestore.FieldValue.delete() :
              "Question backfill stopped before reaching the requested count.",
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
          snap.ref.update({
            status: "FAILED",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalCount: existingState.count,
            durationMs: Date.now() - t0,
            error: "Backfill stopped after too many attempts with limited progress.",
          }),
        ]);
        return null;
      }

      const sourceFileName = await resolveSourceFileName(uid, section.fileId);
      const stepTarget = Math.min(targetCount, existingState.count + BACKFILL_STEP_COUNT);
      const batch = await generateAndPersistBatch({
        uid,
        courseId,
        sectionId,
        section,
        sourceFileName,
        existingCount: existingState.count,
        existingStems: existingState.stems,
        targetCount: stepTarget,
      });

      if (!batch.success) {
        const nextNoProgressStreak = noProgressStreak + 1;
        const shouldStop = attempt >= maxAttempts || nextNoProgressStreak >= MAX_NO_PROGRESS_STREAK;

        if (shouldStop) {
          const fallbackStatus = existingState.count > 0 ? "COMPLETED" : "FAILED";
          await Promise.all([
            sectionRef.update({
              questionsStatus: fallbackStatus,
              questionsCount: existingState.count,
              activeQuestionJobId: admin.firestore.FieldValue.delete(),
              questionsErrorMessage: fallbackStatus === "COMPLETED" ?
                admin.firestore.FieldValue.delete() :
                batch.error || "Question backfill failed.",
              lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
            snap.ref.update({
              status: "FAILED",
              finishedAt: admin.firestore.FieldValue.serverTimestamp(),
              finalCount: existingState.count,
              durationMs: Date.now() - t0,
              error: batch.error || "Question backfill failed.",
            }),
          ]);
          return null;
        }

        const nextJobId = await queueQuestionBackfillJob({
          uid,
          courseId,
          sectionId,
          targetCount,
          attempt: attempt + 1,
          maxAttempts,
          noProgressStreak: nextNoProgressStreak,
          parentJobId: jobId,
        });

        await Promise.all([
          sectionRef.update({
            questionsStatus: "GENERATING",
            questionsCount: existingState.count,
            activeQuestionJobId: nextJobId,
            lastQuestionsDurationMs: Date.now() - t0,
          }),
          snap.ref.update({
            status: "COMPLETED",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalCount: existingState.count,
            durationMs: Date.now() - t0,
            generatedNow: 0,
            nextJobId,
            message: "Retry queued after failed backfill step.",
          }),
        ]);
        return null;
      }

      const finalCount = existingState.count + batch.generatedNow;
      const reachedTarget = finalCount >= targetCount;
      const nextNoProgressStreak = batch.generatedNow > 0 ? 0 : noProgressStreak + 1;
      const outOfAttempts = attempt >= maxAttempts;
      const stalled = nextNoProgressStreak >= MAX_NO_PROGRESS_STREAK;
      const questionGenStats = updateQuestionGenStats(section.questionGenStats, {
        aiRequestCount: batch.aiRequestCount,
        validProduced: batch.generatedNow,
        duplicateSkipped: batch.duplicateStemSkipped,
        latencyMs: batch.durationMs,
        tokenBudget: batch.tokenBudget,
      });

      if (reachedTarget || outOfAttempts || stalled) {
        const fallbackStatus = finalCount > 0 ? "COMPLETED" : "FAILED";
        await Promise.all([
          sectionRef.update({
            questionsStatus: reachedTarget ? "COMPLETED" : fallbackStatus,
            questionsCount: finalCount,
            questionGenStats,
            lastQuestionsDurationMs: batch.durationMs,
            activeQuestionJobId: admin.firestore.FieldValue.delete(),
            questionsErrorMessage: reachedTarget || fallbackStatus === "COMPLETED" ?
              admin.firestore.FieldValue.delete() :
              "Question backfill stopped before reaching the requested count.",
            lastErrorAt: reachedTarget ? admin.firestore.FieldValue.delete() : admin.firestore.FieldValue.serverTimestamp(),
          }),
          snap.ref.update({
            status: reachedTarget || fallbackStatus === "COMPLETED" ? "COMPLETED" : "FAILED",
            finishedAt: admin.firestore.FieldValue.serverTimestamp(),
            finalCount,
            durationMs: Date.now() - t0,
            generatedNow: batch.generatedNow,
            skippedCount: batch.skippedCount,
            aiRequestCount: batch.aiRequestCount,
            message: reachedTarget ?
              "Backfill completed and target count reached." :
              "Backfill stopped before target count was reached.",
          }),
        ]);
        return null;
      }

      const nextJobId = await queueQuestionBackfillJob({
        uid,
        courseId,
        sectionId,
        targetCount,
        attempt: attempt + 1,
        maxAttempts,
        noProgressStreak: nextNoProgressStreak,
        parentJobId: jobId,
      });

      await Promise.all([
        sectionRef.update({
          questionsStatus: "GENERATING",
          questionsCount: finalCount,
          questionGenStats,
          lastQuestionsDurationMs: batch.durationMs,
          activeQuestionJobId: nextJobId,
          questionsErrorMessage: admin.firestore.FieldValue.delete(),
        }),
        snap.ref.update({
          status: "COMPLETED",
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
          finalCount,
          durationMs: Date.now() - t0,
          generatedNow: batch.generatedNow,
          skippedCount: batch.skippedCount,
          aiRequestCount: batch.aiRequestCount,
          nextJobId,
          message: "Backfill step completed; next step queued.",
        }),
      ]);

      return null;
    } catch (error) {
      log.error("Question backfill job failed", {
        uid,
        jobId,
        courseId,
        sectionId,
        error: error.message,
      });

      let fallbackCount = 0;
      try {
        const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId, limit: 40 });
        fallbackCount = existingState.count;
      } catch {
        // Ignore lookup failure and proceed with default fallback.
      }

      try {
        await sectionRef.set(
          {
            questionsStatus: fallbackCount > 0 ? "COMPLETED" : "FAILED",
            questionsCount: fallbackCount,
            activeQuestionJobId: admin.firestore.FieldValue.delete(),
            questionsErrorMessage: fallbackCount > 0 ?
              admin.firestore.FieldValue.delete() :
              (error.message || "Unexpected backfill error."),
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (sectionUpdateError) {
        log.error("Failed to update section after backfill crash", {
          uid,
          sectionId,
          error: sectionUpdateError.message,
        });
      }

      await snap.ref.update({
        status: "FAILED",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
        finalCount: fallbackCount,
        error: error.message || "Unexpected backfill error.",
      });
      return null;
    }
  });
