/**
 * @module explore/exploreLearningProfile
 * @description Lightweight learn-then-compose profile for Explore topic generation.
 *
 * The profile captures stable signals (focus tags, prior stems, quality trend)
 * so subsequent generations can compose faster with less drift/repetition.
 */

const { sanitizeText, sanitizeArray } = require("../lib/sanitize");
const { clampInt, truncate } = require("../lib/utils");

const PROFILE_EMA_ALPHA = 0.35;
const MAX_RECENT_STEMS = 48;
const MAX_FOCUS_TAGS = 8;

function clampFloat(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function toStemKey(stem) {
  return String(stem || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normaliseTopicKey(topic) {
  return String(topic || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function buildExploreProfileDocId(topic, levelId) {
  const levelKey = String(levelId || "MD3")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20) || "MD3";
  const topicKey = normaliseTopicKey(topic) || "topic";
  return `${levelKey}__${topicKey}`;
}

function extractRecentStems(profile, limit = 12) {
  if (!profile || !Array.isArray(profile.recentStems)) return [];
  const deduped = [];
  const seen = new Set();
  for (const stem of profile.recentStems) {
    const cleaned = truncate(sanitizeText(stem), 240);
    const key = toStemKey(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(cleaned);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

function mergeRecentStems(previousStems = [], newQuestions = []) {
  const merged = [];
  const seen = new Set();

  for (const question of Array.isArray(newQuestions) ? newQuestions : []) {
    const stem = truncate(sanitizeText(question?.stem || ""), 240);
    const key = toStemKey(stem);
    if (!stem || !key || seen.has(key)) continue;
    seen.add(key);
    merged.push(stem);
  }

  for (const stem of Array.isArray(previousStems) ? previousStems : []) {
    const cleaned = truncate(sanitizeText(stem), 240);
    const key = toStemKey(cleaned);
    if (!cleaned || !key || seen.has(key)) continue;
    seen.add(key);
    merged.push(cleaned);
    if (merged.length >= MAX_RECENT_STEMS) break;
  }

  return merged.slice(0, MAX_RECENT_STEMS);
}

function deriveFocusTags(questions = [], previousTags = []) {
  const counts = new Map();
  for (const question of Array.isArray(questions) ? questions : []) {
    const tags = Array.isArray(question?.topicTags) ? question.topicTags : [];
    for (const tag of tags) {
      const cleaned = truncate(sanitizeText(tag), 80);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const ranked = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
    .slice(0, MAX_FOCUS_TAGS);

  const recovered = ranked.map((tag) => tag.split(" ").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" "));
  const fallback = sanitizeArray(previousTags || []).slice(0, MAX_FOCUS_TAGS);
  return recovered.length > 0 ? recovered : fallback;
}

function ema(previous, current, alpha = PROFILE_EMA_ALPHA) {
  if (!Number.isFinite(Number(current))) return clampFloat(previous || 0, 0, 1);
  const prev = clampFloat(previous || current, 0, 1);
  const cur = clampFloat(current, 0, 1);
  return Number((prev * (1 - alpha) + cur * alpha).toFixed(4));
}

function computeExploreProfilePatch(previous = {}, input = {}) {
  const topic = truncate(sanitizeText(input.topic || previous.topic || ""), 200);
  const level = truncate(sanitizeText(input.level || previous.level || "MD3"), 20);
  const runs = clampInt(previous.runs || 0, 0, 100_000) + 1;

  const metrics = input.evaluation?.metrics || {};
  const targets = input.evaluation?.targets || {};
  const hardCoverage =
    targets.hardFloorCount > 0
      ? clampFloat((metrics.hardCount || 0) / targets.hardFloorCount, 0, 1)
      : 1;

  return {
    topic,
    level,
    runs,
    modelUsed: truncate(sanitizeText(input.modelUsed || previous.modelUsed || ""), 120),
    focusTags: deriveFocusTags(input.questions, previous.focusTags),
    recentStems: mergeRecentStems(previous.recentStems, input.questions),
    qualityScoreEma: ema(previous.qualityScoreEma, input.evaluation?.qualityScore),
    inBandRatioEma: ema(previous.inBandRatioEma, metrics.inBandRatio),
    hardCoverageEma: ema(previous.hardCoverageEma, hardCoverage),
    updatedAtISO: new Date().toISOString(),
  };
}

function buildLearnedContext(profile = {}, levelProfile = {}) {
  const runs = clampInt(profile.runs || 0, 0, 100_000);
  if (runs <= 0) return "";

  const lines = [];
  const focusTags = Array.isArray(profile.focusTags) ? profile.focusTags.slice(0, 6) : [];
  if (focusTags.length > 0) {
    lines.push(`Prior high-yield focus tags: ${focusTags.join(", ")}.`);
  }

  const qualityScoreEma = clampFloat(profile.qualityScoreEma || 0, 0, 1);
  const inBandRatioEma = clampFloat(profile.inBandRatioEma || 0, 0, 1);
  const hardCoverageEma = clampFloat(profile.hardCoverageEma || 0, 0, 1);
  const advancedLevel = Number(levelProfile.minDifficulty || 1) >= 4;

  if (qualityScoreEma < 0.75 || inBandRatioEma < 0.8) {
    lines.push("Prior runs drifted in relevance. Keep every vignette tightly anchored to the topic and level.");
  }
  if (advancedLevel && hardCoverageEma < 0.8) {
    lines.push("Increase depth: include more difficulty 4-5 scenarios with management trade-offs.");
  }
  if (runs >= 4) {
    lines.push("Vary scenario framing and avoid repeating prior stem patterns.");
  }

  return lines.join(" ");
}

module.exports = {
  MAX_RECENT_STEMS,
  buildExploreProfileDocId,
  extractRecentStems,
  computeExploreProfilePatch,
  buildLearnedContext,
};

