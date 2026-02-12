/**
 * @module lib/sanitize
 * @description Input sanitization utilities to prevent XSS and injection attacks.
 *
 * SECURITY: All user-facing text fields (question stems, options, explanations)
 * must be sanitized before storage to prevent stored XSS attacks.
 */

/**
 * Removes HTML tags and potentially dangerous characters from text.
 * Preserves markdown-safe characters for formatting.
 *
 * @param {string} text - Raw text input
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove script/style content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    // Remove javascript: and data: URLs
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    // Remove event handlers
    .replace(/on\w+\s*=/gi, "")
    // Normalize whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sanitizes an array of strings (e.g., question options).
 *
 * @param {string[]} arr - Array of strings
 * @returns {string[]} Sanitized array
 */
function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((item) => sanitizeText(item)).filter((item) => item.length > 0);
}

/**
 * Sanitizes a question object before storage.
 *
 * @param {Object} question - Question object
 * @returns {Object} Sanitized question
 */
function sanitizeQuestion(question) {
  return {
    ...question,
    stem: sanitizeText(question.stem),
    options: sanitizeArray(question.options),
    explanation: sanitizeText(question.explanation),
    rationale: sanitizeText(question.rationale),
    clinicalPearl: sanitizeText(question.clinicalPearl),
  };
}

module.exports = {
  sanitizeText,
  sanitizeArray,
  sanitizeQuestion,
};
