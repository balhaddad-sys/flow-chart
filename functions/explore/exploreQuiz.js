/**
 * @module explore/exploreQuiz
 * @description Callable function that generates ephemeral MCQ questions
 * on any free-text medical topic using AI model routing by level.
 *
 * - MD1/MD2/MD3 → Gemini 2.0 Flash (fast, cheap)
 * - MD4+        → Claude Haiku 4.5 (better reasoning)
 * - Fallback: if Gemini yields < 50% valid questions, retry with Claude.
 *
 * Questions are NOT persisted to Firestore.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { normaliseQuestion } = require("../lib/serialize");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const { EXPLORE_QUESTIONS_SYSTEM, exploreQuestionsUserPrompt } = require("../ai/prompts");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const ADVANCED_LEVELS = new Set(["MD4", "MD5", "INTERN", "RESIDENT", "POSTGRADUATE"]);
const EXPERT_LEVELS = new Set(["RESIDENT", "POSTGRADUATE"]);

function buildExploreTargets(levelProfile, requestedCount) {
  const safeCount = Math.max(3, requestedCount);
  const targets = {
    requestCount: Math.min(20, safeCount + 1),
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

function shouldFallbackToClaude({ generatedCount, requestedCount, levelProfile, metrics, targets }) {
  if (generatedCount < requestedCount) return true;
  if (ADVANCED_LEVELS.has(levelProfile.id) && !meetsQualityGate(metrics, targets)) return true;
  return false;
}

function prioritiseQuestions(questions, levelProfile, requestedCount) {
  const seenStems = new Set();
  const unique = [];
  for (const q of questions) {
    const key = String(q?.stem || "").trim().toLowerCase();
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

function normaliseExploreQuestions(rawQuestions, topic, levelProfile, requestedCount) {
  const defaults = {
    fileId: "explore",
    fileName: "AI Generated",
    sectionId: "explore",
    sectionTitle: topic,
    topicTags: [topic.toLowerCase().replace(/\s+/g, "-")],
  };

  const valid = [];
  for (const raw of rawQuestions) {
    const normalised = normaliseQuestion(raw, defaults);
    if (normalised) {
      valid.push(normalised);
    }
  }

  const selected = prioritiseQuestions(valid, levelProfile, requestedCount);
  const stamp = Date.now();
  return selected.map((question, index) => ({
    ...question,
    id: `explore_${stamp}_${index}`,
  }));
}

exports.exploreQuiz = functions
  .runWith({
    timeoutSeconds: 120,
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
    const targets = buildExploreTargets(levelProfile, count);

    try {
      const userPrompt = exploreQuestionsUserPrompt({
        topic,
        count: targets.requestCount,
        levelLabel: levelProfile.label,
        levelDescription: levelProfile.description || "",
        minDifficulty: levelProfile.minDifficulty,
        maxDifficulty: levelProfile.maxDifficulty,
        hardFloorCount: targets.hardFloorCount,
        expertFloorCount: targets.expertFloorCount,
        complexityGuidance: getComplexityGuidance(levelProfile),
      });

      const geminiOpts = {
        maxTokens: 2800,
        retries: 1,
        temperature: 0.12,
        rateLimitMaxRetries: 1,
        rateLimitRetryDelayMs: 2500,
      };
      const claudeOpts = { maxTokens: 3200, retries: 1 };

      let result = await geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt, geminiOpts);
      let modelUsed = "gemini";

      if (!result.success || !result.data?.questions) {
        log.warn("Gemini explore failed, falling back to Claude", {
          uid, topic, level: levelProfile.id, error: result.error,
        });
        result = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt, claudeOpts);
        modelUsed = "claude-fallback";
        if (!result.success || !result.data?.questions) {
          return fail(Errors.AI_FAILED, "Failed to generate questions. Please try again.");
        }
      }

      let questions = normaliseExploreQuestions(result.data.questions, topic, levelProfile, count);
      if (questions.length === 0) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      let metrics = qualityMetrics(questions, levelProfile);
      const firstPassScore = qualityScore(metrics, targets);

      if (shouldFallbackToClaude({
        generatedCount: questions.length,
        requestedCount: count,
        levelProfile,
        metrics,
        targets,
      })) {
        log.info("Explore first pass below target, running single Claude fallback", {
          uid,
          topic,
          level: levelProfile.id,
          modelUsed,
          metrics,
          targets,
        });

        const fallbackPrompt = exploreQuestionsUserPrompt({
          topic,
          count: targets.requestCount,
          levelLabel: levelProfile.label,
          levelDescription: levelProfile.description || "",
          minDifficulty: levelProfile.minDifficulty,
          maxDifficulty: levelProfile.maxDifficulty,
          hardFloorCount: targets.hardFloorCount,
          expertFloorCount: targets.expertFloorCount,
          complexityGuidance: getComplexityGuidance(levelProfile),
          strictMode: ADVANCED_LEVELS.has(levelProfile.id),
        });
        const fallbackResult = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, fallbackPrompt, claudeOpts);
        if (fallbackResult.success && fallbackResult.data?.questions) {
          const fallbackQuestions = normaliseExploreQuestions(
            fallbackResult.data.questions,
            topic,
            levelProfile,
            count
          );
          if (fallbackQuestions.length > 0) {
            const fallbackMetrics = qualityMetrics(fallbackQuestions, levelProfile);
            const fallbackScore = qualityScore(fallbackMetrics, targets);
            const betterCoverage = fallbackQuestions.length >= questions.length;
            if (fallbackScore >= firstPassScore || betterCoverage) {
              questions = fallbackQuestions;
              metrics = fallbackMetrics;
              modelUsed = `${modelUsed}->claude-fallback`;
            }
          }
        }
      }

      log.info("Explore quiz generated", {
        uid, topic, level: levelProfile.id, requested: count,
        generated: questions.length, modelUsed, metrics, targets, durationMs: Date.now() - t0,
      });

      return ok({ questions, topic, level: levelProfile.id, levelLabel: levelProfile.label, modelUsed });
    } catch (error) {
      return safeError(error, "explore quiz generation");
    }
  });
