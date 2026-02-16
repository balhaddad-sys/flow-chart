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

/**
 * Strip common OCR/extraction noise from raw document text before AI processing.
 * Removes page headers/footers, timestamps, copyright lines, and repeated metadata.
 *
 * @param {string} text - Raw extracted text
 * @returns {string} Cleaned text with noise removed
 */
function stripOCRNoise(text) {
  if (!text || typeof text !== "string") return "";

  return text
    // Page number lines: "Page 12", "page iv", standalone numbers
    .replace(/^[ \t]*page\s+[ivxlcdm\d]+[ \t]*$/gim, "")
    .replace(/^[ \t]*\d{1,4}[ \t]*$/gm, "")
    // Timestamps: "5/13/04 12:59 PM", "2004-01-15T..."
    .replace(/\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s*(AM|PM)?/gi, "")
    // Software/scanner artifacts: "Purves3/eFM", "filename.pdf"
    .replace(/\b\w+\d*\/[a-z]+\b/gi, "")
    .replace(/\b\w+\.(pdf|docx?|pptx?|txt)\b/gi, "")
    // Copyright lines
    .replace(/^.*copyright\s*©?\s*\d{4}.*$/gim, "")
    .replace(/^.*all rights reserved.*$/gim, "")
    .replace(/^.*ISBN[\s:-]*[\d-]+.*$/gim, "")
    .replace(/^.*ISSN[\s:-]*[\d-]+.*$/gim, "")
    // Publisher/catalog lines
    .replace(/^.*Library of Congress.*$/gim, "")
    .replace(/^.*Cataloging[- ]in[- ]Publication.*$/gim, "")
    .replace(/^.*Printed in.*$/gim, "")
    // Repeated blank lines → single blank line
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = {
  sanitizeText,
  sanitizeArray,
  sanitizeQuestion,
  stripOCRNoise,
};
