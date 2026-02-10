/**
 * @module lib/utils
 * @description Pure utility functions shared across MedQ Cloud Functions.
 *
 * All helpers here are side-effect-free and have no Firebase dependencies,
 * making them trivially testable in isolation.
 */

/**
 * Fisher-Yates shuffle (unbiased, O(n)).
 *
 * @template T
 * @param {T[]} array - Source array (not mutated).
 * @returns {T[]} A new shuffled copy.
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Clamp an integer to the given bounds.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Truncate a string to a maximum length.
 * Returns the original string when within bounds; never throws.
 *
 * @param {*} value - Coerced to String if necessary.
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(value, maxLen) {
  const str = String(value ?? "");
  return str.length <= maxLen ? str : str.slice(0, maxLen);
}

/**
 * Return the ISO date string (YYYY-MM-DD) for a Date object.
 *
 * @param {Date} date
 * @returns {string}
 */
function toISODate(date) {
  return date.toISOString().split("T")[0];
}

/**
 * Return the lowercase English weekday name for a Date object.
 *
 * @param {Date} date
 * @returns {string} e.g. "monday"
 */
function weekdayName(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

module.exports = { shuffleArray, clampInt, truncate, toISODate, weekdayName };
