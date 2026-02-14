/**
 * @module processing/extractors/pdfExtractor
 * @description Splits a PDF file into page-range sections with extracted text.
 * Uses paragraph-boundary snapping to avoid splitting mid-sentence.
 */

const pdfParse = require("pdf-parse");
const fs = require("fs");
const { PAGES_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Find the nearest paragraph break (double newline) near a character position.
 * Searches forward up to `maxScan` characters, then backward.
 * Returns the position AFTER the break (start of next paragraph).
 * @param {string} text
 * @param {number} pos - Target position
 * @param {number} maxScan - Max chars to search in each direction
 * @returns {number} Best break position
 */
function snapToBreak(text, pos, maxScan = 500) {
  if (pos <= 0) return 0;
  if (pos >= text.length) return text.length;

  // Search forward for a paragraph break
  for (let i = pos; i < Math.min(pos + maxScan, text.length - 1); i++) {
    if (text[i] === "\n" && text[i + 1] === "\n") {
      return i + 2; // Start of next paragraph
    }
  }

  // Search backward for a paragraph break
  for (let i = pos; i > Math.max(pos - maxScan, 1); i--) {
    if (text[i] === "\n" && text[i - 1] === "\n") {
      return i + 1;
    }
  }

  // No paragraph break found — fall back to nearest sentence boundary
  for (let i = pos; i < Math.min(pos + maxScan, text.length); i++) {
    if (text[i] === "." && (text[i + 1] === " " || text[i + 1] === "\n")) {
      return i + 2;
    }
  }

  return pos; // Last resort: original position
}

/**
 * Extract text from a PDF file and split into sections.
 * Snaps boundaries to paragraph breaks to avoid splitting mid-sentence.
 *
 * @param {string} filePath - Path to the PDF file on disk.
 * @returns {Promise<Array<{ text: string, title: string, startPage: number, endPage: number, estMinutes: number }>>}
 */
async function extractPdfSections(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  const data = await pdfParse(buffer);

  const totalPages = data.numpages;
  const fullText = data.text;
  const charsPerPage = fullText.length / Math.max(totalPages, 1);

  const sections = [];
  let startPage = 1;
  let prevEndChar = 0;

  while (startPage <= totalPages) {
    const endPage = Math.min(startPage + PAGES_PER_SECTION - 1, totalPages);
    const rawEndChar = Math.floor(endPage * charsPerPage);

    // Snap to nearest paragraph boundary
    const startChar = prevEndChar;
    const endChar = endPage === totalPages
      ? fullText.length
      : snapToBreak(fullText, rawEndChar);

    const text = fullText.slice(startChar, endChar).trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      sections.push({
        text,
        title: `Pages ${startPage}\u2013${endPage}`,
        startPage,
        endPage,
        estMinutes: Math.ceil((endPage - startPage + 1) * 3),
      });
    }

    prevEndChar = endChar;
    startPage = endPage + 1;
  }

  // Ensure short documents still produce at least one section.
  if (sections.length === 0) {
    const trimmed = fullText.trim();
    if (trimmed.length > 0) {
      sections.push({
        text: trimmed,
        title: `Pages 1\u2013${Math.max(totalPages, 1)}`,
        startPage: 1,
        endPage: Math.max(totalPages, 1),
        estMinutes: Math.max(1, Math.ceil(trimmed.split(/\s+/).length / 180)),
      });
    }
  }

  return sections;
}

module.exports = { extractPdfSections };
