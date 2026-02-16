/**
 * @module questions/generationPipeline
 * @description Shared helpers for fast-start and background question generation.
 */

const admin = require("firebase-admin");
const { db, batchSet } = require("../lib/firestore");
const { clampInt } = require("../lib/utils");
const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");
const { normaliseQuestion } = require("../lib/serialize");
const { generateQuestions: aiGenerateQuestions } = require("../ai/geminiClient");
const { buildQuestionGenPlan } = require("../ai/selfTuningCostEngine");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");
const {
  FAST_READY_COUNT,
  BACKFILL_STEP_COUNT,
  MAX_NO_PROGRESS_STREAK,
  computeFastStartCounts,
  computeMaxBackfillAttempts,
} = require("./generationPlanning");

const QUESTION_BACKFILL_JOB_TYPE = "QUESTION_BACKFILL";

async function fetchExistingQuestionState({ uid, courseId, sectionId, limit = 120 }) {
  const existingSnap = await db
    .collection(`users/${uid}/questions`)
    .where("courseId", "==", courseId)
    .where("sectionId", "==", sectionId)
    .limit(limit)
    .get();

  return {
    count: existingSnap.size,
    stems: new Set(
      existingSnap.docs
        .map((doc) => String(doc.data().stem || "").trim().toLowerCase())
        .filter(Boolean)
    ),
  };
}

async function resolveSourceFileName(uid, fileId) {
  if (!fileId) return "Unknown";
  const fileDoc = await db.doc(`users/${uid}/files/${fileId}`).get();
  return fileDoc.exists ? fileDoc.data()?.originalName || "Unknown" : "Unknown";
}

async function queueQuestionBackfillJob({
  uid,
  courseId,
  sectionId,
  targetCount,
  attempt = 1,
  maxAttempts = computeMaxBackfillAttempts(targetCount),
  noProgressStreak = 0,
  parentJobId = null,
}) {
  const jobRef = db.collection(`users/${uid}/jobs`).doc();
  await jobRef.set({
    type: QUESTION_BACKFILL_JOB_TYPE,
    status: "PENDING",
    courseId,
    sectionId,
    targetCount: clampInt(targetCount || 10, 1, 30),
    attempt: clampInt(attempt || 1, 1, 200),
    maxAttempts: clampInt(maxAttempts || 30, 1, 200),
    noProgressStreak: clampInt(noProgressStreak || 0, 0, 200),
    parentJobId: parentJobId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    requestedBy: uid,
  });
  return jobRef.id;
}

async function generateAndPersistBatch({
  uid,
  courseId,
  sectionId,
  section,
  sourceFileName,
  existingCount,
  existingStems,
  targetCount,
}) {
  const target = clampInt(targetCount || 10, 1, 30);
  const safeExisting = clampInt(existingCount || 0, 0, 1000);
  const currentStems = existingStems instanceof Set ? existingStems : new Set();

  if (safeExisting >= target) {
    return {
      success: true,
      generatedNow: 0,
      skippedCount: 0,
      duplicateStemSkipped: 0,
      rawGenerated: 0,
      aiRequestCount: 0,
      predictedYield: 1,
      estimatedSavingsPercent: 100,
      distribution: { easy: 0, medium: 0, hard: 0 },
      tokenBudget: 0,
      durationMs: 0,
    };
  }

  const plan = buildQuestionGenPlan({
    requestedCount: target,
    existingCount: safeExisting,
    sectionStats: section.questionGenStats || {},
  });

  if (plan.skipAI || plan.aiRequestCount <= 0) {
    return {
      success: true,
      generatedNow: 0,
      skippedCount: 0,
      duplicateStemSkipped: 0,
      rawGenerated: 0,
      aiRequestCount: 0,
      predictedYield: plan.predictedYield || 1,
      estimatedSavingsPercent: plan.estimatedSavingsPercent || 100,
      distribution: { easy: 0, medium: 0, hard: 0 },
      tokenBudget: plan.tokenBudget || 0,
      durationMs: 0,
    };
  }

  const { easyCount, mediumCount, hardCount } = computeSectionQuestionDifficultyCounts(
    plan.aiRequestCount,
    section.difficulty || 3
  );
  const t0 = Date.now();
  const result = await aiGenerateQuestions(
    QUESTIONS_SYSTEM,
    questionsUserPrompt({
      blueprintJSON: section.blueprint,
      count: plan.aiRequestCount,
      easyCount,
      mediumCount,
      hardCount,
      sectionTitle: section.title || "Section",
      sourceFileName,
    }),
    {
      maxTokens: plan.tokenBudget,
      retries: plan.retries,
      rateLimitMaxRetries: plan.rateLimitMaxRetries,
      rateLimitRetryDelayMs: plan.rateLimitRetryDelayMs,
    }
  );

  if (!result.success || !result.data?.questions) {
    return {
      success: false,
      error: result.error || "Question generation failed",
    };
  }

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
    if (!normalised) continue;

    const stemKey = String(normalised.stem || "").trim().toLowerCase();
    if (stemKey && currentStems.has(stemKey)) {
      duplicateStemSkipped++;
      continue;
    }
    if (stemKey) currentStems.add(stemKey);

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

  if (validItems.length > 0) {
    await batchSet(validItems);
  }

  return {
    success: true,
    generatedNow: validItems.length,
    skippedCount: Math.max(0, result.data.questions.length - validItems.length),
    duplicateStemSkipped,
    rawGenerated: result.data.questions.length,
    aiRequestCount: plan.aiRequestCount,
    predictedYield: plan.predictedYield,
    estimatedSavingsPercent: plan.estimatedSavingsPercent,
    distribution: { easy: easyCount, medium: mediumCount, hard: hardCount },
    tokenBudget: plan.tokenBudget,
    durationMs: Date.now() - t0,
  };
}

module.exports = {
  QUESTION_BACKFILL_JOB_TYPE,
  FAST_READY_COUNT,
  BACKFILL_STEP_COUNT,
  MAX_NO_PROGRESS_STREAK,
  computeFastStartCounts,
  computeMaxBackfillAttempts,
  fetchExistingQuestionState,
  resolveSourceFileName,
  queueQuestionBackfillJob,
  generateAndPersistBatch,
};
