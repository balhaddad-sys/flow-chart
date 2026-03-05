/**
 * @module questions/generationPipeline
 * @description Shared helpers for fast-start and background question generation.
 */

const admin = require("firebase-admin");
const { db, batchSet } = require("../lib/firestore");
const { clampInt } = require("../lib/utils");
const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");
const { normaliseQuestion } = require("../lib/serialize");
const { generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { buildQuestionGenPlan } = require("../ai/selfTuningCostEngine");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");
const {
  FAST_READY_COUNT,
  BACKFILL_STEP_COUNT,
  MAX_NO_PROGRESS_STREAK,
  computeFastStartCounts,
  computeMaxBackfillAttempts,
} = require("./generationPlanning");
const { STEM_STOP_WORDS, normaliseStem, stemTokenSet, stemSimilarity, isNearDuplicateStem } = require("../lib/stemUtils");

const QUESTION_BACKFILL_JOB_TYPE = "QUESTION_BACKFILL";

function countDistinctStems(stems, threshold = 0.7) {
  const representatives = [];
  for (const stem of stems) {
    if (!stem) continue;
    if (representatives.some((candidate) => isNearDuplicateStem(stem, candidate, threshold))) {
      continue;
    }
    representatives.push(stem);
  }
  return representatives.length;
}

async function fetchExistingQuestionState({ uid, courseId, sectionId, limit = 120 }) {
  const existingSnap = await db
    .collection(`users/${uid}/questions`)
    .where("courseId", "==", courseId)
    .where("sectionId", "==", sectionId)
    .limit(limit)
    .get();

  const existingStems = existingSnap.docs
    .map((doc) => normaliseStem(doc.data().stem))
    .filter(Boolean);

  return {
    count: existingSnap.size,
    distinctCount: countDistinctStems(existingStems),
    stems: new Set(existingStems),
    stemList: existingStems,
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

async function resolveExamType(uid, courseId) {
  try {
    const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
    return (courseDoc.exists ? courseDoc.data()?.examType : null) || "SBA";
  } catch {
    return "SBA";
  }
}

async function generateAndPersistBatch({
  uid,
  courseId,
  sectionId,
  section,
  sourceFileName,
  existingCount,
  existingStems,
  existingStemList,
  targetCount,
  examType,
}) {
  const target = clampInt(targetCount || 10, 1, 30);
  const safeExisting = clampInt(existingCount || 0, 0, 1000);
  const currentStems = existingStems instanceof Set ? existingStems : new Set();
  const currentStemList = Array.isArray(existingStemList)
    ? [...existingStemList]
    : [...currentStems];

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
  const resolvedExamType = examType || await resolveExamType(uid, courseId);

  // Pass up to 8 existing stems as avoidance hints — improves diversity
  const avoidStems = currentStemList.slice(0, 8)
    .map((s) => String(s || "").trim())
    .filter(Boolean);

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
      examType: resolvedExamType,
      avoidStems,
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
  const clientDocs = [];
  let duplicateStemSkipped = 0;
  for (const raw of result.data.questions) {
    const normalised = normaliseQuestion(raw, defaults);
    if (!normalised) continue;

    const stemKey = normaliseStem(normalised.stem);
    const isDuplicateBySimilarity = stemKey &&
      currentStemList.some((existingStem) => isNearDuplicateStem(stemKey, existingStem));

    if (stemKey && (currentStems.has(stemKey) || isDuplicateBySimilarity)) {
      duplicateStemSkipped++;
      continue;
    }
    if (stemKey) {
      currentStems.add(stemKey);
      currentStemList.push(stemKey);
    }

    const docRef = db.collection(`users/${uid}/questions`).doc();
    validItems.push({
      ref: docRef,
      data: {
        courseId,
        sectionId,
        ...normalised,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
    // Keep a client-safe copy (no serverTimestamp sentinel) for inline return
    clientDocs.push({ id: docRef.id, courseId, sectionId, ...normalised });
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
    // Client-safe question documents for inline return to frontend
    docs: clientDocs,
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
  resolveExamType,
  queueQuestionBackfillJob,
  generateAndPersistBatch,
};
