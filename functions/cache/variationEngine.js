/**
 * @module cache/variationEngine
 * @description Ensures no two users see an identical quiz from the same cache pool.
 *
 * Strategy:
 *   1. Filter out recently-seen stems (per-user learning profile).
 *   2. Shuffle the eligible pool (Fisher-Yates via lib/utils.shuffleArray).
 *   3. Select the best `count` questions (via exploreEngine.prioritiseQuestions).
 *   4. Apply micro-variations: shuffle option order, remap correctIndex, stamp new IDs.
 */

const { shuffleArray } = require("../lib/utils");

// ── Stem helpers (mirrors exploreEngine.js:74-86) ───────────────────────

function normaliseStemKey(stem) {
  return String(stem || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function toStemKeySet(stems) {
  const set = new Set();
  if (!Array.isArray(stems)) return set;
  for (const stem of stems) {
    const key = normaliseStemKey(stem);
    if (key) set.add(key);
  }
  return set;
}

// ── Question scoring (mirrors exploreEngine.js:179-205) ─────────────────

function scoreQuestion(q, levelProfile) {
  const min = levelProfile.minDifficulty || 1;
  const max = levelProfile.maxDifficulty || 5;
  const midpoint = (min + max) / 2;
  const highPriority = min >= 4;

  const inBand = q.difficulty >= min && q.difficulty <= max ? 100 : 0;
  const distancePenalty = Math.abs(q.difficulty - midpoint) * 12;
  const hardBonus = highPriority ? q.difficulty * 9 : q.difficulty * 4;
  const citationBonus = Math.min(3, Array.isArray(q.citations) ? q.citations.length : 0) * 3;

  return inBand + hardBonus + citationBonus - distancePenalty;
}

function prioritiseQuestions(questions, levelProfile, count) {
  const seenStems = new Set();
  const unique = [];
  for (const q of questions) {
    const key = normaliseStemKey(q?.stem);
    if (!key || seenStems.has(key)) continue;
    seenStems.add(key);
    unique.push(q);
  }

  return unique
    .sort((a, b) => scoreQuestion(b, levelProfile) - scoreQuestion(a, levelProfile))
    .slice(0, count);
}

// ── Micro-variation ─────────────────────────────────────────────────────

/**
 * Apply micro-variation to a single question:
 *   - Shuffle options (Fisher-Yates on index array)
 *   - Remap correctIndex to match new order
 *   - Remap explanation.whyOthersWrong to match new order
 *   - Stamp a new per-user ID
 */
function varyQuestion(question, newId) {
  const optionCount = (question.options || []).length;
  if (optionCount === 0) return { ...question, id: newId };

  // Build shuffled index mapping: shuffledIndices[newPos] = originalPos
  const indices = Array.from({ length: optionCount }, (_, i) => i);
  const shuffledIndices = shuffleArray(indices);

  const newOptions = shuffledIndices.map((i) => question.options[i]);
  const newCorrectIndex = shuffledIndices.indexOf(question.correctIndex);

  const oldWOW = question.explanation?.whyOthersWrong || [];
  const newWOW = shuffledIndices.map((i) => oldWOW[i] || "This option is incorrect.");

  return {
    ...question,
    id: newId,
    options: newOptions,
    correctIndex: newCorrectIndex,
    explanation: {
      ...question.explanation,
      whyOthersWrong: newWOW,
    },
  };
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * Select and vary `count` questions from a cached pool.
 *
 * @param {Array} pool          - Cached question array (up to 60).
 * @param {number} count        - Desired quiz size (3-20).
 * @param {object} levelProfile - Assessment level profile ({ id, minDifficulty, maxDifficulty, ... }).
 * @param {string[]} [excludeStems] - Recently-seen stems to filter out.
 * @returns {Array} Varied questions with new per-user IDs and shuffled options.
 */
function selectAndVary(pool, count, levelProfile, excludeStems = []) {
  if (!Array.isArray(pool) || pool.length === 0) return [];

  // Step 1: Filter out recently-seen stems
  const excludeSet = toStemKeySet(excludeStems);
  const eligible = pool.filter((q) => {
    const key = normaliseStemKey(q?.stem);
    return key && !excludeSet.has(key);
  });

  // If too few eligible after filtering, relax the exclusion
  const source = eligible.length >= count ? eligible : pool;

  // Step 2: Shuffle for randomness
  const shuffled = shuffleArray(source);

  // Step 3: Select best `count` via quality scoring
  const selected = prioritiseQuestions(shuffled, levelProfile, count);

  // Step 4: Apply micro-variations
  const stamp = Date.now();
  return selected.map((q, i) => varyQuestion(q, `explore_${stamp}_${i}`));
}

module.exports = { selectAndVary };
