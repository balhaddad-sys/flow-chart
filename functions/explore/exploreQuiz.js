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
const {
  buildExploreProfileDocId,
  extractRecentStems,
  computeExploreProfilePatch,
  buildLearnedContext,
} = require("./exploreLearningProfile");

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
  profileDocId,
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
    profileDocId: profileDocId || null,
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
    const profileDocId = buildExploreProfileDocId(topic, levelProfile.id);
    const profileRef = db.doc(`users/${uid}/exploreProfiles/${profileDocId}`);

    let profile = null;
    try {
      const profileSnap = await profileRef.get();
      profile = profileSnap.exists ? profileSnap.data() : null;
    } catch (error) {
      log.warn("Explore profile read failed; proceeding without learned context", {
        uid,
        topic,
        level: levelProfile.id,
        error: error.message,
      });
    }

    const learnedContext = buildLearnedContext(profile, levelProfile);
    const profileExcludeStems = extractRecentStems(profile, 12);

    try {
      const fastStart = await generateExploreQuestions({
        topic,
        levelProfile,
        count: fastReadyCount,
        mode: "fast",
        learnedContext,
        excludeStems: profileExcludeStems,
        totalBudgetMs: 35_000,
      });

      if (!fastStart.success || !fastStart.questions?.length) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      const readyQuestions = fastStart.questions.slice(0, fastReadyCount);
      if (readyQuestions.length === 0) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      // Persist each question to users/{uid}/questions/{id} so submitAttempt
      // can look them up when the student answers.
      const now = admin.firestore.FieldValue.serverTimestamp();
      const qBatch = db.batch();
      for (const q of readyQuestions) {
        if (!q.id) continue;
        const qRef = db.doc(`users/${uid}/questions/${q.id}`);
        qBatch.set(qRef, {
          ...q,
          courseId: `explore_${topic}`,
          createdAt: now,
        });
      }
      await qBatch.commit();

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
          profileDocId,
        });
        backgroundQueued = true;
      }

      try {
        const profilePatch = computeExploreProfilePatch(profile || {}, {
          topic,
          level: levelProfile.id,
          modelUsed: fastStart.modelUsed,
          questions: readyQuestions,
          evaluation: {
            qualityScore: fastStart.qualityScore,
            metrics: fastStart.metrics,
            targets: fastStart.targets,
          },
        });
        const payload = {
          ...profilePatch,
          topic,
          level: levelProfile.id,
          levelLabel: levelProfile.label,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (!profile?.createdAt) {
          payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }
        await profileRef.set(payload, { merge: true });
      } catch (profileWriteError) {
        log.warn("Explore profile update failed after fast-start", {
          uid,
          topic,
          level: levelProfile.id,
          error: profileWriteError.message,
        });
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
        learnedProfileRuns: profile?.runs || 0,
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
