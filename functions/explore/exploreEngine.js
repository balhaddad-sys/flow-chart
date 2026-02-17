/**
 * @module explore/exploreEngine
 * @description Shared Explore generation engine (fast-start + full backfill).
 */

const { normaliseQuestion } = require("../lib/serialize");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const { EXPLORE_QUESTIONS_SYSTEM, exploreQuestionsUserPrompt } = require("../ai/prompts");

const ADVANCED_LEVELS = new Set(["MD4", "MD5", "INTERN", "RESIDENT", "POSTGRADUATE"]);
const EXPERT_LEVELS = new Set(["RESIDENT", "POSTGRADUATE"]);

const MAX_PRIMARY_REQUEST_COUNT_ADVANCED = 12;
const MAX_SUPPLEMENT_REQUEST_COUNT = 10;

const FAST_GEMINI_TIMEOUT_MS = 25_000;
const FAST_CLAUDE_TIMEOUT_MS = 25_000;
const FULL_GEMINI_TIMEOUT_MS = 45_000;
const FULL_CLAUDE_TIMEOUT_MS = 45_000;

function buildExploreTargets(levelProfile, requestedCount) {
  const safeCount = Math.max(3, requestedCount);
  const targets = {
    requestCount: Math.min(20, safeCount + 1),
    primaryRequestCount: Math.min(20, safeCount + 1),
    inBandRatio: 0.75,
    hardFloorCount: 0,
    expertFloorCount: 0,
  };

  if (levelProfile.id === "MD3") {
    targets.inBandRatio = 0.78;
    targets.hardFloorCount = Math.max(1, Math.ceil(safeCount * 0.2));
    return targets;
  }

  if (ADVANCED_LEVELS.has(levelProfile.id)) {
    targets.requestCount = Math.min(20, safeCount + 2);
    targets.primaryRequestCount = Math.min(MAX_PRIMARY_REQUEST_COUNT_ADVANCED, safeCount + 1);
    targets.inBandRatio = 0.8;
    targets.hardFloorCount = Math.max(1, Math.ceil(safeCount * 0.45));
  }

  if (EXPERT_LEVELS.has(levelProfile.id)) {
    targets.inBandRatio = 0.85;
    targets.hardFloorCount = Math.max(1, Math.ceil(safeCount * 0.6));
    targets.expertFloorCount = Math.max(1, Math.ceil(safeCount * 0.15));
  }

  return targets;
}

function buildTokenBudget(requestCount, { advanced = false, rescue = false, fast = false } = {}) {
  const safeCount = Math.max(3, Math.min(20, Number(requestCount) || 10));
  const base = fast ? 560 : advanced ? 900 : 700;
  const perQuestion = fast ? 170 : advanced ? 240 : 210;
  const hardCap = rescue ? 4200 : fast ? 2600 : advanced ? 4600 : 3800;
  return Math.min(hardCap, base + safeCount * perQuestion);
}

function withTimeout(taskPromise, timeoutMs, timeoutLabel) {
  return Promise.race([
    taskPromise,
    new Promise((resolve) => {
      setTimeout(
        () => resolve({ success: false, error: `${timeoutLabel} timed out after ${timeoutMs}ms` }),
        timeoutMs
      );
    }),
  ]);
}

function normaliseStemKey(stem) {
  return String(stem || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function toStemSet(stems) {
  const set = new Set();
  if (!Array.isArray(stems)) return set;
  for (const stem of stems) {
    const key = normaliseStemKey(stem);
    if (key) set.add(key);
  }
  return set;
}

function extractStemHints(questions, limit = 8) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => String(q?.stem || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function mergeQuestionSets(questionSets, levelProfile, requestedCount) {
  const merged = [];
  for (const set of questionSets) {
    if (Array.isArray(set) && set.length > 0) merged.push(...set);
  }
  return prioritiseQuestions(merged, levelProfile, requestedCount);
}

function computeRescueRequestCount({ requestedCount, currentCount, metrics, targets }) {
  const missing = Math.max(0, requestedCount - currentCount);
  const hardGap = Math.max(0, (targets.hardFloorCount || 0) - (metrics.hardCount || 0));
  const expertGap = Math.max(0, (targets.expertFloorCount || 0) - (metrics.expertCount || 0));
  const needed = missing + hardGap + expertGap;
  if (needed <= 0) return 0;
  return Math.min(MAX_PRIMARY_REQUEST_COUNT_ADVANCED, Math.max(3, needed));
}

function getComplexityGuidance(levelProfile) {
  switch (levelProfile.id) {
    case "MD4":
      return "Use multi-step clinical reasoning with diagnostic-to-management transitions and contraindication checks.";
    case "MD5":
    case "INTERN":
      return "Emphasize next-best-step decisions, guideline-concordant treatment, and prioritization under time pressure.";
    case "RESIDENT":
      return "Use high-acuity vignettes with nuanced management trade-offs, escalation thresholds, and protocol-level decisions.";
    case "POSTGRADUATE":
      return "Use subspecialty-level complexity, edge-case interpretation, and expert differential prioritization.";
    default:
      return "Match complexity to training level and avoid trivia-only recall items.";
  }
}

function qualityMetrics(questions, levelProfile) {
  const min = levelProfile.minDifficulty;
  const max = levelProfile.maxDifficulty;
  const total = Math.max(questions.length, 1);

  const inBandCount = questions.filter((q) => q.difficulty >= min && q.difficulty <= max).length;
  const hardCount = questions.filter((q) => q.difficulty >= 4).length;
  const expertCount = questions.filter((q) => q.difficulty >= 5).length;

  return {
    total: questions.length,
    inBandCount,
    inBandRatio: inBandCount / total,
    hardCount,
    expertCount,
  };
}

function qualityScore(metrics, targets) {
  const inBandScore = Math.min(1, metrics.inBandRatio / Math.max(targets.inBandRatio, 0.01));
  const hardScore = targets.hardFloorCount > 0 ? Math.min(1, metrics.hardCount / targets.hardFloorCount) : 1;
  const expertScore = targets.expertFloorCount > 0 ? Math.min(1, metrics.expertCount / targets.expertFloorCount) : 1;
  return inBandScore * 0.55 + hardScore * 0.3 + expertScore * 0.15;
}

function meetsQualityGate(metrics, targets) {
  if (metrics.total === 0) return false;
  if (metrics.inBandRatio < targets.inBandRatio) return false;
  if (targets.hardFloorCount > 0 && metrics.hardCount < targets.hardFloorCount) return false;
  if (targets.expertFloorCount > 0 && metrics.expertCount < targets.expertFloorCount) return false;
  return true;
}

function evaluateQuestionSet(questions, levelProfile, requestedCount) {
  const targets = buildExploreTargets(levelProfile, requestedCount);
  const metrics = qualityMetrics(questions, levelProfile);
  return {
    targets,
    metrics,
    qualityGatePassed: meetsQualityGate(metrics, targets),
    qualityScore: Number(qualityScore(metrics, targets).toFixed(3)),
  };
}

function shouldFallbackToClaude({ generatedCount, requestedCount, levelProfile, metrics, targets }) {
  if (generatedCount < requestedCount) return true;
  if (ADVANCED_LEVELS.has(levelProfile.id) && !meetsQualityGate(metrics, targets)) return true;
  return false;
}

function prioritiseQuestions(questions, levelProfile, requestedCount) {
  const seenStems = new Set();
  const unique = [];
  for (const q of questions) {
    const key = normaliseStemKey(q?.stem);
    if (!key || seenStems.has(key)) continue;
    seenStems.add(key);
    unique.push(q);
  }

  const min = levelProfile.minDifficulty;
  const max = levelProfile.maxDifficulty;
  const midpoint = (min + max) / 2;
  const highPriority = levelProfile.minDifficulty >= 4;

  const scoreQuestion = (q) => {
    const inBand = q.difficulty >= min && q.difficulty <= max ? 100 : 0;
    const distancePenalty = Math.abs(q.difficulty - midpoint) * 12;
    const hardBonus = highPriority ? q.difficulty * 9 : q.difficulty * 4;
    const citationBonus = Math.min(3, Array.isArray(q.citations) ? q.citations.length : 0) * 3;
    return inBand + hardBonus + citationBonus - distancePenalty;
  };

  return unique
    .sort((a, b) => scoreQuestion(b) - scoreQuestion(a))
    .slice(0, requestedCount);
}

function normaliseExploreQuestions(rawQuestions, topic, levelProfile, requestedCount, excludeStemSet) {
  const defaults = {
    fileId: "explore",
    fileName: "AI Generated",
    sectionId: "explore",
    sectionTitle: topic,
    topicTags: [topic.toLowerCase().replace(/\s+/g, "-")],
  };

  const valid = [];
  const blocked = excludeStemSet instanceof Set ? excludeStemSet : new Set();

  for (const raw of rawQuestions || []) {
    const normalised = normaliseQuestion(raw, defaults);
    if (!normalised) continue;
    const key = normaliseStemKey(normalised.stem);
    if (!key || blocked.has(key)) continue;
    valid.push(normalised);
  }

  const selected = prioritiseQuestions(valid, levelProfile, requestedCount);
  const stamp = Date.now();
  return selected.map((question, index) => ({
    ...question,
    id: `explore_${stamp}_${index}`,
  }));
}

async function generateFastStartQuestions({
  topic,
  levelProfile,
  requestedCount,
  targets,
  excludeStemSet,
  learnedContext = "",
}) {
  const phaseDurationsMs = {};
  const isAdvanced = ADVANCED_LEVELS.has(levelProfile.id);
  const primaryRequestCount = Math.min(8, Math.max(3, requestedCount + 1));
  const buildPrompt = ({ requestCount, excludeStems = [] }) =>
    exploreQuestionsUserPrompt({
      topic,
      count: requestCount,
      levelLabel: levelProfile.label,
      levelDescription: levelProfile.description || "",
      minDifficulty: levelProfile.minDifficulty,
      maxDifficulty: levelProfile.maxDifficulty,
      hardFloorCount: targets.hardFloorCount,
      expertFloorCount: targets.expertFloorCount,
      complexityGuidance: getComplexityGuidance(levelProfile),
      strictMode: isAdvanced,
      conciseMode: true,
      learnedContext,
      excludeStems,
    });

  const prompt = buildPrompt({ requestCount: primaryRequestCount });
  const geminiOpts = {
    maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced, fast: true }),
    retries: 0,
    temperature: isAdvanced ? 0.1 : 0.12,
    rateLimitMaxRetries: 1,
    rateLimitRetryDelayMs: 2500,
  };

  const geminiT0 = Date.now();
  const geminiResult = await withTimeout(
    geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, prompt, geminiOpts).catch((error) => ({
      success: false,
      error: error.message,
    })),
    FAST_GEMINI_TIMEOUT_MS,
    "Gemini fast generation"
  );
  phaseDurationsMs.geminiFast = Date.now() - geminiT0;

  let questions =
    geminiResult.success && geminiResult.data?.questions
      ? normaliseExploreQuestions(
        geminiResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      )
      : [];
  let modelUsed = "gemini-fast";

  if (questions.length === 0) {
    const fallbackPrompt = buildPrompt({ requestCount: primaryRequestCount });
    const claudeOpts = {
      maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced, fast: true }),
      retries: 0,
      usePrefill: false,
    };

    const claudeT0 = Date.now();
    const claudeResult = await withTimeout(
      claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, fallbackPrompt, claudeOpts).catch((error) => ({
        success: false,
        error: error.message,
      })),
      FAST_CLAUDE_TIMEOUT_MS,
      "Claude fast fallback generation"
    );
    phaseDurationsMs.claudeFastFallback = Date.now() - claudeT0;

    if (claudeResult.success && claudeResult.data?.questions) {
      questions = normaliseExploreQuestions(
        claudeResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      );
      modelUsed = "claude-fast-fallback";
    }
  }

  questions = prioritiseQuestions(questions, levelProfile, requestedCount);
  const evaluation = evaluateQuestionSet(questions, levelProfile, requestedCount);

  return {
    ...evaluation,
    questions,
    modelUsed,
    phaseDurationsMs,
    success: questions.length > 0,
    error: questions.length > 0 ? null : "No valid fast-start questions generated.",
  };
}

async function generateFullQuestions({
  topic,
  levelProfile,
  requestedCount,
  targets,
  excludeStemSet,
  totalBudgetMs,
  learnedContext = "",
}) {
  const isAdvanced = ADVANCED_LEVELS.has(levelProfile.id);
  const phaseDurationsMs = {};
  const startedAt = Date.now();

  const buildPrompt = ({ requestCount, excludeStems = [], strictMode = isAdvanced, conciseMode = isAdvanced }) =>
    exploreQuestionsUserPrompt({
      topic,
      count: requestCount,
      levelLabel: levelProfile.label,
      levelDescription: levelProfile.description || "",
      minDifficulty: levelProfile.minDifficulty,
      maxDifficulty: levelProfile.maxDifficulty,
      hardFloorCount: targets.hardFloorCount,
      expertFloorCount: targets.expertFloorCount,
      complexityGuidance: getComplexityGuidance(levelProfile),
      strictMode,
      conciseMode,
      learnedContext,
      excludeStems,
    });

  const primaryRequestCount = isAdvanced ? targets.primaryRequestCount : targets.requestCount;
  const primaryPrompt = buildPrompt({
    requestCount: primaryRequestCount,
    excludeStems: Array.from(excludeStemSet).slice(0, 8),
  });
  const geminiPrimaryOpts = {
    maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced }),
    retries: 1,
    temperature: isAdvanced ? 0.1 : 0.12,
    rateLimitMaxRetries: 1,
    rateLimitRetryDelayMs: 2500,
  };

  const geminiPrimaryT0 = Date.now();
  const geminiPrimaryResult = await withTimeout(
    geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, primaryPrompt, geminiPrimaryOpts).catch((error) => ({
      success: false,
      error: error.message,
    })),
    FULL_GEMINI_TIMEOUT_MS,
    "Gemini primary generation"
  );
  phaseDurationsMs.geminiPrimary = Date.now() - geminiPrimaryT0;

  const geminiPrimaryQs =
    geminiPrimaryResult.success && geminiPrimaryResult.data?.questions
      ? normaliseExploreQuestions(
        geminiPrimaryResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      )
      : [];

  let questions = [];
  let metrics = qualityMetrics([], levelProfile);
  let modelUsed = "gemini";

  if (isAdvanced) {
    let geminiAggregate = [...geminiPrimaryQs];
    modelUsed = "gemini-primary";

    if (geminiAggregate.length < requestedCount) {
      const missing = Math.max(0, requestedCount - geminiAggregate.length);
      const supplementRequestCount = Math.min(MAX_SUPPLEMENT_REQUEST_COUNT, Math.max(3, missing + 1));

      if (supplementRequestCount >= 3) {
        const supplementPrompt = buildPrompt({
          requestCount: supplementRequestCount,
          excludeStems: extractStemHints(geminiAggregate).concat(Array.from(excludeStemSet).slice(0, 4)),
        });
        const geminiSupplementOpts = {
          ...geminiPrimaryOpts,
          maxTokens: buildTokenBudget(supplementRequestCount, { advanced: true }),
          retries: 0,
        };

        const geminiSupplementT0 = Date.now();
        const geminiSupplementResult = await withTimeout(
          geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, supplementPrompt, geminiSupplementOpts).catch((error) => ({
            success: false,
            error: error.message,
          })),
          FULL_GEMINI_TIMEOUT_MS,
          "Gemini supplement generation"
        );
        phaseDurationsMs.geminiSupplement = Date.now() - geminiSupplementT0;

        const geminiSupplementQs =
          geminiSupplementResult.success && geminiSupplementResult.data?.questions
            ? normaliseExploreQuestions(
              geminiSupplementResult.data.questions,
              topic,
              levelProfile,
              supplementRequestCount,
              excludeStemSet
            )
            : [];

        if (geminiSupplementQs.length > 0) {
          geminiAggregate = mergeQuestionSets(
            [geminiAggregate, geminiSupplementQs],
            levelProfile,
            Math.max(requestedCount, primaryRequestCount)
          );
          modelUsed = "gemini-primary+supplement";
        }
      }
    }

    questions = prioritiseQuestions(geminiAggregate, levelProfile, requestedCount);
    metrics = qualityMetrics(questions, levelProfile);

    const elapsed = Date.now() - startedAt;
    const budgetLeft = elapsed < totalBudgetMs;
    if (
      budgetLeft &&
      shouldFallbackToClaude({
        generatedCount: questions.length,
        requestedCount,
        levelProfile,
        metrics,
        targets,
      })
    ) {
      const rescueRequestCount = computeRescueRequestCount({
        requestedCount,
        currentCount: questions.length,
        metrics,
        targets,
      });

      if (rescueRequestCount > 0) {
        const rescuePrompt = buildPrompt({
          requestCount: rescueRequestCount,
          excludeStems: extractStemHints(questions).concat(Array.from(excludeStemSet).slice(0, 4)),
          strictMode: true,
          conciseMode: true,
        });
        const claudeRescueOpts = {
          maxTokens: buildTokenBudget(rescueRequestCount, { advanced: true, rescue: true }),
          retries: 0,
          usePrefill: false,
        };

        const claudeRescueT0 = Date.now();
        const claudeRescueResult = await withTimeout(
          claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, rescuePrompt, claudeRescueOpts).catch((error) => ({
            success: false,
            error: error.message,
          })),
          FULL_CLAUDE_TIMEOUT_MS,
          "Claude rescue generation"
        );
        phaseDurationsMs.claudeRescue = Date.now() - claudeRescueT0;

        const claudeRescueQs =
          claudeRescueResult.success && claudeRescueResult.data?.questions
            ? normaliseExploreQuestions(
              claudeRescueResult.data.questions,
              topic,
              levelProfile,
              rescueRequestCount,
              excludeStemSet
            )
            : [];

        if (claudeRescueQs.length > 0) {
          questions = mergeQuestionSets([questions, claudeRescueQs], levelProfile, requestedCount);
          metrics = qualityMetrics(questions, levelProfile);
          modelUsed = `${modelUsed}+claude-rescue`;
        }
      }
    }
  } else {
    questions = [...geminiPrimaryQs];
    metrics = qualityMetrics(questions, levelProfile);
    modelUsed = "gemini";

    if (questions.length === 0) {
      const claudeFallbackPrompt = buildPrompt({
        requestCount: primaryRequestCount,
        strictMode: false,
        conciseMode: false,
      });
      const claudeFallbackOpts = {
        maxTokens: buildTokenBudget(primaryRequestCount, { advanced: false }),
        retries: 1,
        usePrefill: false,
      };

      const claudeFallbackT0 = Date.now();
      const claudeFallbackResult = await withTimeout(
        claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, claudeFallbackPrompt, claudeFallbackOpts).catch((error) => ({
          success: false,
          error: error.message,
        })),
        FULL_CLAUDE_TIMEOUT_MS,
        "Claude fallback generation"
      );
      phaseDurationsMs.claudeFallback = Date.now() - claudeFallbackT0;

      if (claudeFallbackResult.success && claudeFallbackResult.data?.questions) {
        questions = normaliseExploreQuestions(
          claudeFallbackResult.data.questions,
          topic,
          levelProfile,
          requestedCount,
          excludeStemSet
        );
        metrics = qualityMetrics(questions, levelProfile);
        modelUsed = "claude-fallback";
      }
    }
  }

  if (questions.length === 0) {
    return {
      success: false,
      error: "No valid questions generated.",
      questions: [],
      modelUsed,
      metrics,
      targets,
      qualityGatePassed: false,
      qualityScore: 0,
      phaseDurationsMs,
    };
  }

  const qualityGatePassed = meetsQualityGate(metrics, targets);
  const qualityScoreValue = Number(qualityScore(metrics, targets).toFixed(3));

  return {
    success: true,
    questions,
    modelUsed,
    metrics,
    targets,
    qualityGatePassed,
    qualityScore: qualityScoreValue,
    phaseDurationsMs,
  };
}

async function generateExploreQuestions({
  topic,
  levelProfile,
  count,
  mode = "full",
  learnedContext = "",
  excludeStems = [],
  totalBudgetMs = 75_000,
}) {
  const requestedCount = Math.max(3, Math.min(20, Number(count) || 10));
  const targets = buildExploreTargets(levelProfile, requestedCount);
  const excludeStemSet = toStemSet(excludeStems);

  if (mode === "fast") {
    return generateFastStartQuestions({
      topic,
      levelProfile,
      requestedCount,
      targets,
      excludeStemSet,
      learnedContext,
    });
  }

  return generateFullQuestions({
    topic,
    levelProfile,
    requestedCount,
    targets,
    excludeStemSet,
    learnedContext,
    totalBudgetMs: Math.max(30_000, Number(totalBudgetMs) || 75_000),
  });
}

module.exports = {
  ADVANCED_LEVELS,
  buildExploreTargets,
  buildTokenBudget,
  extractStemHints,
  mergeQuestionSets,
  prioritiseQuestions,
  qualityMetrics,
  qualityScore,
  meetsQualityGate,
  evaluateQuestionSet,
  generateExploreQuestions,
};
