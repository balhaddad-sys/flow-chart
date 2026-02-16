/**
 * @module explore/exploreQuiz
 * @description Callable function that generates an Explore quiz quickly,
 * returning a fast-start batch and optionally queueing background backfill.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateExploreQuestions } = require("./exploreEngine");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const EXPLORE_BACKFILL_JOB_TYPE = "EXPLORE_QUIZ_BACKFILL";
const FAST_READY_COUNT = 3;

async function queueExploreBackfillJob({
  uid,
  topic,
  levelProfile,
  targetCount,
  seedQuestions,
  modelUsed,
  qualityGatePassed,
  qualityScore,
}) {
  const jobRef = db.collection(`users/${uid}/jobs`).doc();
  await jobRef.set({
    type: EXPLORE_BACKFILL_JOB_TYPE,
    status: "PENDING",
    topic,
    level: levelProfile.id,
    levelLabel: levelProfile.label,
    targetCount,
    questions: seedQuestions,
    generatedCount: seedQuestions.length,
    remainingCount: Math.max(0, targetCount - seedQuestions.length),
    modelUsed,
    qualityGatePassed,
    qualityScore,
    requestedBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return jobRef.id;
}

exports.exploreQuiz = functions
  .runWith({
    timeoutSeconds: 180,
    memory: "512MB",
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const t0 = Date.now();
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "topic", maxLen: 200 },
      { field: "level", maxLen: 20 },
    ]);
    const count = requireInt(data, "count", 3, 20, 10);

    await checkRateLimit(uid, "exploreQuiz", RATE_LIMITS.exploreQuiz);

    const { topic, level } = data;
    const levelProfile = getAssessmentLevel(level);
    const fastReadyCount = Math.min(FAST_READY_COUNT, count);

    try {
      const fastStart = await generateExploreQuestions({
        topic,
        levelProfile,
        count: fastReadyCount,
        mode: "fast",
        totalBudgetMs: 35_000,
      });

      if (!fastStart.success || !fastStart.questions?.length) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      const readyQuestions = fastStart.questions.slice(0, fastReadyCount);
      if (readyQuestions.length === 0) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      const remainingCount = Math.max(0, count - readyQuestions.length);
      let backgroundJobId = null;
      let backgroundQueued = false;

      if (remainingCount > 0) {
        backgroundJobId = await queueExploreBackfillJob({
          uid,
          topic,
          levelProfile,
          targetCount: count,
          seedQuestions: readyQuestions,
          modelUsed: fastStart.modelUsed,
          qualityGatePassed: fastStart.qualityGatePassed,
          qualityScore: fastStart.qualityScore,
        });
        backgroundQueued = true;
      }

      log.info("Explore quiz generated (fast-start)", {
        uid,
        topic,
        level: levelProfile.id,
        requested: count,
        readyNow: readyQuestions.length,
        remainingCount,
        modelUsed: fastStart.modelUsed,
        qualityGatePassed: fastStart.qualityGatePassed,
        qualityScore: fastStart.qualityScore,
        phaseDurationsMs: fastStart.phaseDurationsMs,
        backgroundQueued,
        backgroundJobId,
        durationMs: Date.now() - t0,
      });

      return ok({
        questions: readyQuestions,
        topic,
        level: levelProfile.id,
        levelLabel: levelProfile.label,
        modelUsed: fastStart.modelUsed,
        qualityGatePassed: fastStart.qualityGatePassed,
        qualityScore: fastStart.qualityScore,
        targetCount: count,
        readyNow: readyQuestions.length,
        remainingCount,
        backgroundQueued,
        backgroundJobId,
      });
    } catch (error) {
      return safeError(error, "explore quiz generation");
    }
  });
