/**
 * @module lib/stemUtils
 * @description Shared stem normalisation, tokenisation, and near-duplicate
 * detection utilities used by both the question generation pipeline and
 * the assessment engine.
 */

const STEM_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "then",
  "there", "these", "this", "to", "was", "were", "which", "with", "patient", "most",
  "likely", "following", "best", "next", "step", "regarding", "shows", "showing",
  "findings", "presentation", "clinical", "diagnosis", "management", "question",
]);

function normaliseStem(stem) {
  return String(stem || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemTokenSet(stem) {
  const tokens = normaliseStem(stem)
    .split(" ")
    .filter((token) => token.length > 2 && !STEM_STOP_WORDS.has(token));
  return new Set(tokens);
}

function stemSimilarity(stemA, stemB) {
  const a = stemTokenSet(stemA);
  const b = stemTokenSet(stemB);
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap++;
  }

  return overlap / Math.max(a.size, b.size);
}

function isNearDuplicateStem(stemA, stemB, threshold = 0.68) {
  const a = normaliseStem(stemA);
  const b = normaliseStem(stemB);
  if (!a || !b) return false;
  if (a === b) return true;

  if ((a.length >= 90 || b.length >= 90) && (a.includes(b) || b.includes(a))) {
    return true;
  }

  return stemSimilarity(a, b) >= threshold;
}

module.exports = { STEM_STOP_WORDS, normaliseStem, stemTokenSet, stemSimilarity, isNearDuplicateStem };
