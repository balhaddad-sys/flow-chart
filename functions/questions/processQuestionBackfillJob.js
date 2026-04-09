/**
 * @module questions/processQuestionBackfillJob
 * @description Firestore-triggered worker for background question generation.
 *
 * ARCHITECTURE (v2 — single-shot loop):
 *
 *  Instead of chaining N Firestore job documents (one per retry), this worker
 *  runs an internal loop within a single invocation. Each iteration generates
 *  a batch of questions and checks progress. This eliminates:
 *    - Excessive Firestore job documents
 *    - Redundant question re-fetches between chained jobs
 *    - Trigger propagation latency between job documents
 *
 *  The function has a 300s timeout — enough for 5+ Gemini calls (~10s each).
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { updateQuestionGenStats } = require("../ai/selfTuningCostEngine");
const log = require("../lib/logger");
const { MAX_QUESTIONS_PER_SECTION } = require("../lib/constants");
const {
  QUESTION_BACKFILL_JOB_TYPE,
  MAX_NO_PROGRESS_STREAK,
  fetchExistingQuestionState,
  resolveSourceFileName,
  resolveExamType,
  generateAndPersistBatch,
} = require("./generationPipeline");

const hfApiKey = functions.params.defineSecret("HF_API_KEY");

/** Maximum AI calls per single invocation. */
const MAX_ITERATIONS = 8;

/** Safety margin: stop looping if we're within this many ms of the function timeout. */
const TIMEOUT_BUFFER_MS = 30_000;

/** Function timeout in ms (must match runWith config). */
const FUNCTION_TIMEOUT_MS = 300_000;

exports.processQuestionBackfillJob = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "512MB",
    secrets: [hfApiKey],
  })
  .firestore.document("users/{uid}/jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const t0 = Date.now();
    const { uid, jobId } = context.params;
    const job = snap.data() || {};

    if (job.type !== QUESTION_BACKFILL_JOB_TYPE) return null;

    // ── Claim job via transaction ───────────────────────────────────────
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

    if (!claimed) return null;

    const courseId = String(job.courseId || "");
    const sectionId = String(job.sectionId || "");
    const targetCount = Math.max(1, Math.min(MAX_QUESTIONS_PER_SECTION, Number(job.targetCount || 10)));
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
      // ── Validate section ──────────────────────────────────────────────
      const sectionDoc = await sectionRef.get();
      if (!sectionDoc.exists) {
        await _failJob(snap.ref, t0, "Section not found for question backfill.");
        return null;
      }

      const section = sectionDoc.data();
      if (section.courseId !== courseId || !section.blueprint) {
        await _failJob(snap.ref, t0, "Section is invalid for question backfill.");
        return null;
      }

      // Resolve metadata once (not per iteration)
      const [sourceFileName, examType] = await Promise.all([
        resolveSourceFileName(uid, section.fileId),
        resolveExamType(uid, courseId),
      ]);

      // ── Generation loop ───────────────────────────────────────────────
      let totalGenerated = 0;
      let totalSkipped = 0;
      let totalAiRequests = 0;
      let noProgressStreak = 0;
      let iterations = 0;
      let lastBatchStats = null;

      for (let i = 0; i < MAX_ITERATIONS; i++) {
        iterations++;

        // Safety: stop if we're running low on time
        if (Date.now() - t0 > FUNCTION_TIMEOUT_MS - TIMEOUT_BUFFER_MS) {
          log.warn("Backfill loop stopping — approaching timeout", {
            uid, sectionId, jobId,
            elapsedMs: Date.now() - t0,
            iterations,
          });
          break;
        }

        // Refresh existing question state
        const existingState = await fetchExistingQuestionState({ uid, courseId, sectionId });
        const currentDistinct = existingState.distinctCount || existingState.count;

        // Target reached — we're done!
        if (currentDistinct >= targetCount) break;

        // Too many failed attempts — stop
        if (noProgressStreak >= MAX_NO_PROGRESS_STREAK) {
          log.warn("Backfill stalled — no progress streak limit reached", {
            uid, sectionId, jobId, noProgressStreak,
          });
          break;
        }

        // Generate a batch
        const batch = await generateAndPersistBatch({
          uid,
          courseId,
          sectionId,
          section,
          sourceFileName,
          existingCount: currentDistinct,
          existingStems: existingState.stems,
          existingStemList: existingState.stemList,
          targetCount,
          examType,
        });

        lastBatchStats = batch;

        if (!batch.success || (batch.generatedNow || 0) === 0) {
          noProgressStreak++;
          continue;
        }

        // Progress made — accumulate stats and reset streak
        totalGenerated += batch.generatedNow;
        totalSkipped += batch.skippedCount || 0;
        totalAiRequests += batch.aiRequestCount || 0;
        noProgressStreak = 0;

        // Update section progress (so frontend can see count growing)
        await sectionRef.update({
          questionsStatus: "GENERATING",
          questionsCount: existingState.count + batch.generatedNow,
        });
      }

      // ── Finalize ──────────────────────────────────────────────────────
      const finalState = await fetchExistingQuestionState({ uid, courseId, sectionId });
      const finalDistinct = finalState.distinctCount || finalState.count;
      const reachedTarget = finalDistinct >= targetCount;
      const finalStatus = finalDistinct > 0 ? "COMPLETED" : "FAILED";

      // Update self-tuning stats if we have batch data
      let questionGenStats = section.questionGenStats || {};
      if (lastBatchStats && lastBatchStats.success) {
        questionGenStats = updateQuestionGenStats(questionGenStats, {
          aiRequestCount: totalAiRequests,
          validProduced: totalGenerated,
          duplicateSkipped: totalSkipped,
          latencyMs: Date.now() - t0,
          tokenBudget: lastBatchStats.tokenBudget || 0,
        });
      }

      await Promise.all([
        sectionRef.update({
          questionsStatus: finalStatus,
          questionsCount: finalState.count,
          questionGenStats,
          lastQuestionsDurationMs: Date.now() - t0,
          activeQuestionJobId: admin.firestore.FieldValue.delete(),
          questionsErrorMessage: finalStatus === "COMPLETED"
            ? admin.firestore.FieldValue.delete()
            : "Question backfill did not reach target count.",
          lastErrorAt: finalStatus === "COMPLETED"
            ? admin.firestore.FieldValue.delete()
            : admin.firestore.FieldValue.serverTimestamp(),
        }),
        snap.ref.update({
          status: finalStatus === "FAILED" ? "FAILED" : "COMPLETED",
          finishedAt: admin.firestore.FieldValue.serverTimestamp(),
          finalCount: finalState.count,
          totalGenerated,
          totalSkipped,
          totalAiRequests,
          iterations,
          noProgressStreak,
          durationMs: Date.now() - t0,
          message: reachedTarget
            ? "Backfill completed — target reached."
            : finalDistinct > 0
              ? "Backfill completed with partial results."
              : "Backfill failed — no questions could be generated.",
        }),
      ]);

      log.info("Backfill job finished", {
        uid, sectionId, jobId,
        status: finalStatus,
        targetCount,
        finalCount: finalState.count,
        totalGenerated,
        iterations,
        durationMs: Date.now() - t0,
      });

      return null;
    } catch (error) {
      log.error("Question backfill job failed", {
        uid, jobId, courseId, sectionId,
        error: error.message,
      });

      // Recover: count whatever questions exist and set appropriate status
      let fallbackCount = 0;
      try {
        const state = await fetchExistingQuestionState({ uid, courseId, sectionId, limit: 40 });
        fallbackCount = state.count;
      } catch (err) { console.warn("fetchExistingQuestionState fallback failed:", err.message); }

      try {
        await sectionRef.set(
          {
            questionsStatus: fallbackCount > 0 ? "COMPLETED" : "FAILED",
            questionsCount: fallbackCount,
            activeQuestionJobId: admin.firestore.FieldValue.delete(),
            questionsErrorMessage: fallbackCount > 0
              ? admin.firestore.FieldValue.delete()
              : (error.message || "Unexpected backfill error."),
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (sectionUpdateError) {
        log.error("Failed to update section after backfill crash", {
          uid, sectionId,
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

/** Helper: mark a job as failed with a message. */
async function _failJob(jobRef, t0, errorMessage) {
  await jobRef.update({
    status: "FAILED",
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    durationMs: Date.now() - t0,
    error: errorMessage,
  });
}
