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

const GEMINI_LEVELS = new Set(["MD1", "MD2", "MD3"]);

function normaliseExploreQuestions(rawQuestions, topic) {
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
      normalised.id = `explore_${Date.now()}_${valid.length}`;
      valid.push(normalised);
    }
  }
  return valid;
}

exports.exploreQuiz = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "topic", maxLen: 200 },
      { field: "level", maxLen: 20 },
    ]);
    const count = requireInt(data, "count", 3, 20, 10);

    await checkRateLimit(uid, "exploreQuiz", RATE_LIMITS.exploreQuiz);

    const { topic, level } = data;
    const levelProfile = getAssessmentLevel(level);

    try {
      const userPrompt = exploreQuestionsUserPrompt({
        topic,
        count,
        levelLabel: levelProfile.label,
        levelDescription: levelProfile.description || "",
        minDifficulty: levelProfile.minDifficulty,
        maxDifficulty: levelProfile.maxDifficulty,
      });

      const useGemini = GEMINI_LEVELS.has(levelProfile.id);
      let result;
      let modelUsed;

      if (useGemini) {
        result = await geminiGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt);
        modelUsed = "gemini";

        if (result.success && result.data?.questions) {
          const validated = normaliseExploreQuestions(result.data.questions, topic);
          if (validated.length < Math.ceil(count * 0.5)) {
            log.warn("Gemini explore below threshold, falling back to Claude", {
              uid, topic, level: levelProfile.id, geminiValid: validated.length, requested: count,
            });
            result = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt);
            modelUsed = "claude-fallback";
          }
        } else if (!result.success) {
          log.warn("Gemini explore failed, falling back to Claude", {
            uid, topic, level: levelProfile.id, error: result.error,
          });
          result = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt);
          modelUsed = "claude-fallback";
        }
      } else {
        result = await claudeGenerate(EXPLORE_QUESTIONS_SYSTEM, userPrompt);
        modelUsed = "claude";
      }

      if (!result.success || !result.data?.questions) {
        return fail(Errors.AI_FAILED, "Failed to generate questions. Please try again.");
      }

      const questions = normaliseExploreQuestions(result.data.questions, topic);
      if (questions.length === 0) {
        return fail(Errors.AI_FAILED, "AI generated no valid questions. Try a different topic.");
      }

      log.info("Explore quiz generated", {
        uid, topic, level: levelProfile.id, requested: count,
        generated: questions.length, modelUsed,
      });

      return ok({ questions, topic, level: levelProfile.id, levelLabel: levelProfile.label, modelUsed });
    } catch (error) {
      return safeError(error, "explore quiz generation");
    }
  });
