/**
 * @module lib/difficulty
 * @description Helpers for allocating AI question difficulty counts.
 */

const { DIFFICULTY_DISTRIBUTION } = require("./constants");
const { clampInt } = require("./utils");

function clampNumber(value, min, max) {
  const numeric = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, numeric));
}

/**
 * Build easy/medium/hard counts for section-based generation.
 * Higher-difficulty sections receive more hard items.
 *
 * @param {number} count
 * @param {number} [sectionDifficulty=3]
 * @returns {{ easyCount: number, mediumCount: number, hardCount: number, sectionDifficulty: number }}
 */
function computeSectionQuestionDifficultyCounts(count, sectionDifficulty = 3) {
  const safeCount = clampInt(count || 1, 1, 200);
  const safeDifficulty = clampNumber(Number(sectionDifficulty) || 3, 1, 5);

  // Map section difficulty [1..5] to bias [-1..1].
  const bias = (safeDifficulty - 3) / 2;

  const baseEasy = clampNumber(DIFFICULTY_DISTRIBUTION.easy || 0.35, 0.15, 0.5);
  const baseHard = clampNumber(DIFFICULTY_DISTRIBUTION.hard || 0.3, 0.2, 0.6);

  // Harder sections skew toward hard questions; easier sections skew toward easy.
  let easyRatio = clampNumber(baseEasy - 0.15 * bias, 0.15, 0.5);
  let hardRatio = clampNumber(baseHard + 0.2 * bias, 0.2, 0.6);
  let mediumRatio = clampNumber(1 - easyRatio - hardRatio, 0.1, 0.7);

  // Normalize to guard against clamp edge cases.
  const ratioSum = easyRatio + mediumRatio + hardRatio;
  easyRatio /= ratioSum;
  mediumRatio /= ratioSum;
  hardRatio /= ratioSum;

  let easyCount = Math.round(safeCount * easyRatio);
  let hardCount = Math.round(safeCount * hardRatio);
  let mediumCount = safeCount - easyCount - hardCount;

  // If rounding overflowed, trim the larger bucket first.
  while (mediumCount < 0) {
    if (hardCount >= easyCount && hardCount > 0) {
      hardCount--;
    } else if (easyCount > 0) {
      easyCount--;
    } else {
      break;
    }
    mediumCount = safeCount - easyCount - hardCount;
  }

  return { easyCount, mediumCount, hardCount, sectionDifficulty: safeDifficulty };
}

module.exports = {
  computeSectionQuestionDifficultyCounts,
};

