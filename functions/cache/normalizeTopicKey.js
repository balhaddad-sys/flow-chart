/**
 * @module cache/normalizeTopicKey
 * @description Deterministic cache-key generation from free-text medical topics.
 *
 * Extends the existing `normaliseTopicKey` pattern in exploreLearningProfile.js
 * with noise-suffix stripping so that synonymous inputs collapse to one key:
 *   "Brachial plexus anatomy" → "brachial-plexus"
 *   "Brachial Plexus"         → "brachial-plexus"
 *   "brachial plexus overview" → "brachial-plexus"
 */

const NOISE_SUFFIXES = new Set([
  "anatomy",
  "physiology",
  "pathology",
  "management",
  "overview",
  "review",
  "basics",
  "introduction",
  "summary",
  "clinical",
  "medical",
  "disease",
  "disorder",
  "syndrome",
  "condition",
]);

/**
 * Normalise a free-text topic string into a stable, URL-safe key.
 *
 * @param {string} topic - Raw topic from user input.
 * @returns {string} Normalised key (lowercase, hyphenated, max 80 chars).
 */
function normalizeTopicKey(topic) {
  let normalized = String(topic || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  // Strip trailing noise words that don't change medical meaning.
  const words = normalized.split(" ");
  while (words.length > 1 && NOISE_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }

  return (
    words
      .join("-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "topic"
  );
}

/**
 * Build a Firestore-safe cache key for a topic + level (+ optional exam type).
 *
 * Examples:
 *   buildCacheKey("Brachial plexus", "MD3")          → "MD3__brachial-plexus"
 *   buildCacheKey("Sepsis", "MD4", "PLAB1")           → "MD4__PLAB1__sepsis"
 *
 * @param {string} topic
 * @param {string} level
 * @param {string|null} [examType]
 * @returns {string}
 */
function buildCacheKey(topic, level, examType) {
  const topicKey = normalizeTopicKey(topic);
  const levelKey =
    String(level || "MD3")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 20) || "MD3";

  if (examType) {
    const examKey = String(examType)
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "")
      .slice(0, 20);
    return `${levelKey}__${examKey}__${topicKey}`;
  }

  return `${levelKey}__${topicKey}`;
}

module.exports = { normalizeTopicKey, buildCacheKey };
