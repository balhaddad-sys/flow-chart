/**
 * @module explore/exploreEngine
 * @description Shared Explore generation engine (fast-start + full backfill).
 */

const { normaliseQuestion } = require("../lib/serialize");
const { withTimeout } = require("../lib/utils");
const { verifyQuestionEvidenceBatch } = require("../lib/citationVerification");
const { isNearDuplicateStem, normaliseStem } = require("../lib/stemUtils");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { EXPLORE_QUESTIONS_SYSTEM, exploreQuestionsUserPrompt } = require("../ai/prompts");

const ADVANCED_LEVELS = new Set(["MD4", "MD5", "INTERN", "RESIDENT", "POSTGRADUATE"]);
const EXPERT_LEVELS = new Set(["RESIDENT", "POSTGRADUATE"]);

const MAX_PRIMARY_REQUEST_COUNT_ADVANCED = 10;
const MAX_SUPPLEMENT_REQUEST_COUNT = 8;

// Claude is primary (more surgical with evidence-based content)
const FAST_PRIMARY_TIMEOUT_MS = 30_000;
const FAST_FALLBACK_TIMEOUT_MS = 25_000;
const FULL_PRIMARY_TIMEOUT_MS = 55_000;
const FULL_FALLBACK_TIMEOUT_MS = 45_000;

function buildExploreTargets(levelProfile, requestedCount) {
  const safeCount = Math.max(3, requestedCount);
  const targets = {
    requestCount: Math.min(18, safeCount),
    primaryRequestCount: Math.min(18, safeCount),
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
    targets.requestCount = Math.min(18, safeCount + 1);
    targets.primaryRequestCount = Math.min(MAX_PRIMARY_REQUEST_COUNT_ADVANCED, safeCount);
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
  // Keep Explore generation lean: enough room for evidence-based reasoning
  // without the older oversized token ceilings.
  const base = fast ? 520 : advanced ? 880 : 720;
  const perQuestion = fast ? 220 : advanced ? 320 : 260;
  const hardCap = rescue ? 4800 : fast ? 3200 : advanced ? 5200 : 4400;
  return Math.min(hardCap, base + safeCount * perQuestion);
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

function verifiedCitationCount(question) {
  const fromCitationArray = Array.isArray(question?.citations)
    ? question.citations.filter((c) => c?.verified).length
    : 0;
  const fromMeta = Number(question?.citationMeta?.verifiedCount || 0);
  return Math.max(fromCitationArray, fromMeta);
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
  // Fuzzy dedup: reject questions whose stems are near-duplicates of already-accepted ones
  const acceptedStems = [];
  const unique = [];
  for (const q of questions) {
    const stem = normaliseStem(q?.stem);
    if (!stem) continue;
    if (acceptedStems.some((existing) => isNearDuplicateStem(stem, existing))) continue;
    acceptedStems.push(stem);
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
    const citationBonus = Math.min(3, verifiedCitationCount(q)) * 4;
    const fallbackPenalty = q?.citationMeta?.fallbackUsed ? 2 : 0;
    return inBand + hardBonus + citationBonus - fallbackPenalty - distancePenalty;
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
  const blockedExact = excludeStemSet instanceof Set ? excludeStemSet : new Set();
  // Build a list of normalised exclude stems for fuzzy comparison
  const blockedStems = Array.from(blockedExact).map((s) => normaliseStem(s)).filter(Boolean);

  for (const raw of rawQuestions || []) {
    const normalised = normaliseQuestion(raw, defaults);
    if (!normalised) continue;
    const stem = normaliseStem(normalised.stem);
    if (!stem) continue;
    // Exact match against the blocked set
    const key = normaliseStemKey(normalised.stem);
    if (key && blockedExact.has(key)) continue;
    // Fuzzy match against blocked stems
    if (blockedStems.some((existing) => isNearDuplicateStem(stem, existing))) continue;
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
  const primaryRequestCount = Math.min(6, Math.max(3, requestedCount));
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
  const claudeOpts = {
    maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced, fast: true }),
    retries: 0,
    usePrefill: true,
  };

  const claudeT0 = Date.now();
  const claudeResult = await withTimeout(
    claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, prompt, claudeOpts).catch((error) => ({
      success: false,
      error: error.message,
    })),
    FAST_PRIMARY_TIMEOUT_MS,
    "Claude fast generation"
  );
  phaseDurationsMs.claudeFast = Date.now() - claudeT0;

  let questions =
    claudeResult.success && claudeResult.data?.questions
      ? normaliseExploreQuestions(
        claudeResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      )
      : [];
  let modelUsed = "claude-fast";

  if (questions.length === 0) {
    const fallbackPrompt = buildPrompt({ requestCount: primaryRequestCount });
    const geminiOpts = {
      maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced, fast: true }),
      retries: 0,
      temperature: isAdvanced ? 0.1 : 0.12,
      rateLimitMaxRetries: 1,
      rateLimitRetryDelayMs: 2500,
    };

    const geminiT0 = Date.now();
    const geminiResult = await withTimeout(
      geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, fallbackPrompt, geminiOpts).catch((error) => ({
        success: false,
        error: error.message,
      })),
      FAST_FALLBACK_TIMEOUT_MS,
      "Gemini fast fallback generation"
    );
    phaseDurationsMs.geminiFastFallback = Date.now() - geminiT0;

    if (geminiResult.success && geminiResult.data?.questions) {
      questions = normaliseExploreQuestions(
        geminiResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      );
      modelUsed = "gemini-fast-fallback";
    }
  }

  questions = await verifyQuestionEvidenceBatch(questions, { maxRemoteChecks: 1 });
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
  // Claude is primary — more surgical with evidence-based guidelines and citations
  const claudePrimaryOpts = {
    maxTokens: buildTokenBudget(primaryRequestCount, { advanced: isAdvanced }),
    retries: 1,
    usePrefill: true,
  };

  const claudePrimaryT0 = Date.now();
  const claudePrimaryResult = await withTimeout(
    claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, primaryPrompt, claudePrimaryOpts).catch((error) => ({
      success: false,
      error: error.message,
    })),
    FULL_PRIMARY_TIMEOUT_MS,
    "Claude primary generation"
  );
  phaseDurationsMs.claudePrimary = Date.now() - claudePrimaryT0;

  const claudePrimaryQs =
    claudePrimaryResult.success && claudePrimaryResult.data?.questions
      ? normaliseExploreQuestions(
        claudePrimaryResult.data.questions,
        topic,
        levelProfile,
        primaryRequestCount,
        excludeStemSet
      )
      : [];

  let questions = [];
  let metrics = qualityMetrics([], levelProfile);
  let modelUsed = "claude";

  if (isAdvanced) {
    let claudeAggregate = [...claudePrimaryQs];
    modelUsed = "claude-primary";

    if (claudeAggregate.length < requestedCount) {
      const missing = Math.max(0, requestedCount - claudeAggregate.length);
      const supplementRequestCount = Math.min(MAX_SUPPLEMENT_REQUEST_COUNT, Math.max(3, missing + 1));

      if (supplementRequestCount >= 3) {
        const supplementPrompt = buildPrompt({
          requestCount: supplementRequestCount,
          excludeStems: extractStemHints(claudeAggregate).concat(Array.from(excludeStemSet).slice(0, 4)),
        });
        const claudeSupplementOpts = {
          ...claudePrimaryOpts,
          maxTokens: buildTokenBudget(supplementRequestCount, { advanced: true }),
          retries: 0,
        };

        const claudeSupplementT0 = Date.now();
        const claudeSupplementResult = await withTimeout(
          claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, supplementPrompt, claudeSupplementOpts).catch((error) => ({
            success: false,
            error: error.message,
          })),
          FULL_PRIMARY_TIMEOUT_MS,
          "Claude supplement generation"
        );
        phaseDurationsMs.claudeSupplement = Date.now() - claudeSupplementT0;

        const claudeSupplementQs =
          claudeSupplementResult.success && claudeSupplementResult.data?.questions
            ? normaliseExploreQuestions(
              claudeSupplementResult.data.questions,
              topic,
              levelProfile,
              supplementRequestCount,
              excludeStemSet
            )
            : [];

        if (claudeSupplementQs.length > 0) {
          claudeAggregate = mergeQuestionSets(
            [claudeAggregate, claudeSupplementQs],
            levelProfile,
            Math.max(requestedCount, primaryRequestCount)
          );
          modelUsed = "claude-primary+supplement";
        }
      }
    }

    questions = prioritiseQuestions(claudeAggregate, levelProfile, requestedCount);
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
      // Use Gemini as rescue when Claude supplement wasn't enough
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
        const geminiRescueOpts = {
          maxTokens: buildTokenBudget(rescueRequestCount, { advanced: true, rescue: true }),
          retries: 0,
          temperature: 0.1,
          rateLimitMaxRetries: 1,
          rateLimitRetryDelayMs: 2500,
        };

        const geminiRescueT0 = Date.now();
        const geminiRescueResult = await withTimeout(
          geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, rescuePrompt, geminiRescueOpts).catch((error) => ({
            success: false,
            error: error.message,
          })),
          FULL_FALLBACK_TIMEOUT_MS,
          "Gemini rescue generation"
        );
        phaseDurationsMs.geminiRescue = Date.now() - geminiRescueT0;

        const geminiRescueQs =
          geminiRescueResult.success && geminiRescueResult.data?.questions
            ? normaliseExploreQuestions(
              geminiRescueResult.data.questions,
              topic,
              levelProfile,
              rescueRequestCount,
              excludeStemSet
            )
            : [];

        if (geminiRescueQs.length > 0) {
          questions = mergeQuestionSets([questions, geminiRescueQs], levelProfile, requestedCount);
          metrics = qualityMetrics(questions, levelProfile);
          modelUsed = `${modelUsed}+gemini-rescue`;
        }
      }
    }
  } else {
    questions = [...claudePrimaryQs];
    metrics = qualityMetrics(questions, levelProfile);
    modelUsed = "claude";

    if (questions.length === 0) {
      // Gemini fallback for non-advanced levels
      const geminiFallbackPrompt = buildPrompt({
        requestCount: primaryRequestCount,
        strictMode: false,
        conciseMode: false,
      });
      const geminiFallbackOpts = {
        maxTokens: buildTokenBudget(primaryRequestCount, { advanced: false }),
        retries: 1,
        temperature: 0.12,
        rateLimitMaxRetries: 1,
        rateLimitRetryDelayMs: 2500,
      };

      const geminiFallbackT0 = Date.now();
      const geminiFallbackResult = await withTimeout(
        geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, geminiFallbackPrompt, geminiFallbackOpts).catch((error) => ({
          success: false,
          error: error.message,
        })),
        FULL_FALLBACK_TIMEOUT_MS,
        "Gemini fallback generation"
      );
      phaseDurationsMs.geminiFallback = Date.now() - geminiFallbackT0;

      if (geminiFallbackResult.success && geminiFallbackResult.data?.questions) {
        questions = normaliseExploreQuestions(
          geminiFallbackResult.data.questions,
          topic,
          levelProfile,
          requestedCount,
          excludeStemSet
        );
        metrics = qualityMetrics(questions, levelProfile);
        modelUsed = "gemini-fallback";
      }
    }
  }

  if (questions.length > 0) {
    questions = await verifyQuestionEvidenceBatch(questions, { maxRemoteChecks: 1 });
    questions = prioritiseQuestions(questions, levelProfile, requestedCount);
    metrics = qualityMetrics(questions, levelProfile);
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
