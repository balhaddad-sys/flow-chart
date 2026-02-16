/**
 * @module explore/processExploreBackfillJob
 * @description Firestore-triggered worker that backfills Explore questions in the background.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateExploreQuestions, mergeQuestionSets, evaluateQuestionSet } = require("./exploreEngine");
const log = require("../lib/logger");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const EXPLORE_BACKFILL_JOB_TYPE = "EXPLORE_QUIZ_BACKFILL";

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(Number(value) || 0)));
}

exports.processExploreBackfillJob = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "512MB",
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .firestore.document("users/{uid}/jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const t0 = Date.now();
    const { uid, jobId } = context.params;
    const job = snap.data() || {};

    if (job.type !== EXPLORE_BACKFILL_JOB_TYPE) return null;

    const claimed = await snap.ref.firestore.runTransaction(async (tx) => {
      const current = await tx.get(snap.ref);
      if (!current.exists) return false;
      const latest = current.data() || {};
      if (latest.status !== "PENDING") return false;
      tx.update(snap.ref, {
        status: "RUNNING",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!claimed) return null;

    const topic = String(job.topic || "").trim();
    const level = String(job.level || "MD3");
    const targetCount = clampInt(job.targetCount, 3, 20);
    const seedQuestions = Array.isArray(job.questions) ? job.questions : [];

    if (!topic) {
      await snap.ref.update({
        status: "FAILED",
        error: "Missing topic in backfill job payload.",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
      });
      return null;
    }

    const levelProfile = getAssessmentLevel(level);
    const alreadyReady = Math.max(0, seedQuestions.length);
    const remainingCount = Math.max(0, targetCount - alreadyReady);

    if (remainingCount === 0) {
      const evaluation = evaluateQuestionSet(seedQuestions, levelProfile, targetCount);
      await snap.ref.update({
        status: "COMPLETED",
        questions: seedQuestions,
        generatedCount: seedQuestions.length,
        remainingCount: 0,
        qualityGatePassed: evaluation.qualityGatePassed,
        qualityScore: evaluation.qualityScore,
        metrics: evaluation.metrics,
        targets: evaluation.targets,
        message: "Backfill skipped: target was already satisfied.",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
      });
      return null;
    }

    try {
      const generationCount = Math.min(20, Math.max(3, remainingCount + 1));
      const excludeStems = seedQuestions
        .map((q) => String(q?.stem || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      const generated = await generateExploreQuestions({
        topic,
        levelProfile,
        count: generationCount,
        mode: "full",
        excludeStems,
        totalBudgetMs: 120_000,
      });

      const mergedQuestions = generated.success
        ? mergeQuestionSets([seedQuestions, generated.questions], levelProfile, targetCount)
        : seedQuestions;
      const finalRemaining = Math.max(0, targetCount - mergedQuestions.length);
      const evaluation = evaluateQuestionSet(mergedQuestions, levelProfile, targetCount);

      await snap.ref.update({
        status: "COMPLETED",
        questions: mergedQuestions,
        generatedCount: mergedQuestions.length,
        remainingCount: finalRemaining,
        modelUsed: `${String(job.modelUsed || "fast-start")}+${generated.modelUsed || "backfill"}`,
        qualityGatePassed: evaluation.qualityGatePassed,
        qualityScore: evaluation.qualityScore,
        metrics: evaluation.metrics,
        targets: evaluation.targets,
        phaseDurationsMs: generated.phaseDurationsMs || {},
        backfillSucceeded: finalRemaining === 0,
        message: finalRemaining === 0 ?
          "Backfill completed and target count reached." :
          `Backfill completed with ${mergedQuestions.length}/${targetCount} questions.`,
        error: generated.success ? admin.firestore.FieldValue.delete() : generated.error || "Backfill failed.",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
      });

      log.info("Explore backfill job completed", {
        uid,
        jobId,
        topic,
        level: levelProfile.id,
        targetCount,
        readyAtStart: alreadyReady,
        finalCount: mergedQuestions.length,
        finalRemaining,
        modelUsed: `${String(job.modelUsed || "fast-start")}+${generated.modelUsed || "backfill"}`,
        qualityGatePassed: evaluation.qualityGatePassed,
        qualityScore: evaluation.qualityScore,
        durationMs: Date.now() - t0,
      });
    } catch (error) {
      log.error("Explore backfill job failed", {
        uid,
        jobId,
        topic,
        level: levelProfile.id,
        error: error.message,
      });

      await snap.ref.update({
        status: "FAILED",
        questions: seedQuestions,
        generatedCount: seedQuestions.length,
        remainingCount,
        error: error.message || "Backfill failed.",
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        durationMs: Date.now() - t0,
      });
    }

    return null;
  });
