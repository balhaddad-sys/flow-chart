/**
 * @module explore/exploreTopicInsight
 * @description Callable function that returns a high-yield topic briefing for Explore.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { ok, fail, Errors, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { sanitizeText } = require("../lib/sanitize");
const { truncate } = require("../lib/utils");
const { getAssessmentLevel } = require("../assessment/engine");
const { generateQuestions: geminiGenerate } = require("../ai/geminiClient");
const { generateQuestions: claudeGenerate } = require("../ai/aiClient");
const {
  EXPLORE_TOPIC_INSIGHT_SYSTEM,
  exploreTopicInsightUserPrompt,
} = require("../ai/prompts");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

const MAX_TOPIC_LEN = 200;
const MAX_SUMMARY_LEN = 2_400;
const MAX_LIST_ITEMS = 8;
const GEMINI_TIMEOUT_MS = 35_000;
const CLAUDE_TIMEOUT_MS = 45_000;

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

function normaliseCitationSource(rawSource) {
  const source = String(rawSource || "").toLowerCase().trim();
  if (source.includes("pubmed")) return "PubMed";
  if (source.includes("uptodate") || source.includes("up to date")) return "UpToDate";
  if (source.includes("medscape")) return "Medscape";
  return "PubMed";
}

function buildSearchUrl(source, topic) {
  const query = encodeURIComponent(String(topic || "medical topic").slice(0, 120));
  switch (source) {
    case "UpToDate":
      return `https://www.uptodate.com/contents/search?search=${query}`;
    case "Medscape":
      return `https://www.medscape.com/search?queryText=${query}`;
    case "PubMed":
    default:
      return `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`;
  }
}

function normaliseStringList(input, { maxItems = MAX_LIST_ITEMS, maxLen = 260 } = {}) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => truncate(sanitizeText(item || ""), maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normaliseCitations(rawCitations, topic) {
  const citations = [];
  const seen = new Set();

  const input = Array.isArray(rawCitations) ? rawCitations.slice(0, 8) : [];
  for (const item of input) {
    if (!item) continue;
    const title = truncate(sanitizeText(item.title || item.label || ""), 260);
    if (!title) continue;
    const source = normaliseCitationSource(item.source);
    const key = `${source}:${title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    citations.push({
      source,
      title,
      url: buildSearchUrl(source, title),
    });
    if (citations.length >= 4) break;
  }

  if (citations.length > 0) return citations;

  const fallbackTopic = truncate(sanitizeText(topic || "medical topic"), 90);
  return [
    {
      source: "PubMed",
      title: `PubMed: ${fallbackTopic}`,
      url: buildSearchUrl("PubMed", fallbackTopic),
    },
    {
      source: "UpToDate",
      title: `UpToDate: ${fallbackTopic}`,
      url: buildSearchUrl("UpToDate", fallbackTopic),
    },
    {
      source: "Medscape",
      title: `Medscape: ${fallbackTopic}`,
      url: buildSearchUrl("Medscape", fallbackTopic),
    },
  ];
}

function normaliseInsightPayload(raw, topic) {
  const summary = truncate(
    sanitizeText(raw?.summary || raw?.overview || ""),
    MAX_SUMMARY_LEN
  );
  const corePoints = normaliseStringList(raw?.core_points || raw?.corePoints || raw?.key_points || raw?.keyPoints, {
    maxItems: 8,
    maxLen: 320,
  });
  const clinicalPitfalls = normaliseStringList(raw?.clinical_pitfalls || raw?.pitfalls, {
    maxItems: 6,
    maxLen: 240,
  });
  const redFlags = normaliseStringList(raw?.red_flags || raw?.redFlags, {
    maxItems: 6,
    maxLen: 220,
  });
  const studyApproach = normaliseStringList(raw?.study_approach || raw?.studyApproach || raw?.next_steps, {
    maxItems: 6,
    maxLen: 220,
  });
  const citations = normaliseCitations(raw?.citations, topic);

  if (!summary && corePoints.length === 0) return null;

  return {
    summary,
    corePoints,
    clinicalPitfalls,
    redFlags,
    studyApproach,
    citations,
  };
}

exports.exploreTopicInsight = functions
  .runWith({
    timeoutSeconds: 90,
    memory: "512MB",
    secrets: [geminiApiKey, anthropicApiKey],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "topic", maxLen: MAX_TOPIC_LEN },
      { field: "level", maxLen: 20 },
    ]);

    await checkRateLimit(uid, "exploreTopicInsight", RATE_LIMITS.exploreTopicInsight);

    const topic = String(data.topic || "").trim();
    const levelProfile = getAssessmentLevel(data.level);
    const prompt = exploreTopicInsightUserPrompt({
      topic,
      levelLabel: levelProfile.label,
      levelDescription: levelProfile.description || "",
    });

    try {
      const geminiT0 = Date.now();
      const geminiResult = await withTimeout(
        geminiGenerate(EXPLORE_TOPIC_INSIGHT_SYSTEM, prompt, {
          maxTokens: 2_400,
          retries: 1,
          temperature: 0.15,
          rateLimitMaxRetries: 1,
          rateLimitRetryDelayMs: 2500,
        }).catch((error) => ({ success: false, error: error.message })),
        GEMINI_TIMEOUT_MS,
        "Gemini topic insight"
      );
      const geminiDurationMs = Date.now() - geminiT0;

      let payload = geminiResult.success && geminiResult.data ?
        normaliseInsightPayload(geminiResult.data, topic) :
        null;
      let modelUsed = "gemini";

      if (!payload) {
        const claudeT0 = Date.now();
        const claudeResult = await withTimeout(
          claudeGenerate(EXPLORE_TOPIC_INSIGHT_SYSTEM, prompt, {
            maxTokens: 2_600,
            retries: 1,
            usePrefill: false,
          }).catch((error) => ({ success: false, error: error.message })),
          CLAUDE_TIMEOUT_MS,
          "Claude topic insight fallback"
        );
        const claudeDurationMs = Date.now() - claudeT0;

        payload = claudeResult.success && claudeResult.data ?
          normaliseInsightPayload(claudeResult.data, topic) :
          null;
        modelUsed = "claude-fallback";

        log.info("Explore topic insight generated with fallback", {
          uid,
          topic,
          level: levelProfile.id,
          geminiSuccess: geminiResult.success,
          geminiDurationMs,
          claudeSuccess: claudeResult.success,
          claudeDurationMs,
        });
      } else {
        log.info("Explore topic insight generated", {
          uid,
          topic,
          level: levelProfile.id,
          modelUsed,
          geminiDurationMs,
        });
      }

      if (!payload) {
        return fail(Errors.AI_FAILED, "Could not generate a topic briefing right now.");
      }

      return ok({
        topic,
        level: levelProfile.id,
        levelLabel: levelProfile.label,
        modelUsed,
        ...payload,
      });
    } catch (error) {
      return safeError(error, "explore topic insight generation");
    }
  });

module.exports.__private = {
  normaliseCitationSource,
  buildSearchUrl,
  normaliseCitations,
  normaliseInsightPayload,
};
