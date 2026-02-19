/**
 * @module processing/extractors/pdfExtractor
 * @description Splits a PDF file into page-range sections with extracted text.
 * Uses paragraph-boundary snapping to avoid splitting mid-sentence.
 * Detects heading-like lines from the text to produce meaningful section titles.
 */

const pdfParse = require("pdf-parse");
const fs = require("fs");
const { PAGES_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Detect heading-like lines from extracted PDF text.
 * A heading candidate is a non-empty line preceded by a blank line (or at
 * the start), between 3–120 chars, starts with a capital letter or numbered
 * prefix, and does NOT end with sentence-continuation punctuation.
 *
 * @param {string} fullText
 * @returns {Array<{ text: string, charOffset: number }>}
 */
function detectHeadings(fullText) {
  const headings = [];
  const lines = fullText.split("\n");
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const prevLine = i > 0 ? lines[i - 1].trim() : "";

    if (
      (i === 0 || prevLine === "") &&
      line.length >= 3 &&
      line.length <= 120 &&
      !/[,;:]$/.test(line) &&           // not a continuation
      /[a-zA-Z]/.test(line) &&           // has letters
      (/^[A-Z]/.test(line) || /^\d+[.\-)]\s*[A-Z]/.test(line)) && // starts capitalised or numbered
      !/^\d+$/.test(line) &&             // not just a bare number
      !/^page\s+\d+$/i.test(line) &&    // not a page marker
      !/^figure\s+\d/i.test(line) &&    // not a figure caption
      !/^table\s+\d/i.test(line)         // not a table caption
    ) {
      headings.push({ text: line, charOffset });
    }

    charOffset += lines[i].length + 1; // +1 for the \n
  }

  return headings;
}

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

  // Detect heading-like lines so sections get meaningful titles
  const headings = detectHeadings(fullText);

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
      // Use first detected heading within this section's char range
      const heading = headings.find(
        (h) => h.charOffset >= startChar && h.charOffset < endChar
      );
      const title = heading ? heading.text : `Pages ${startPage}\u2013${endPage}`;

      sections.push({
        text,
        title,
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
      const heading = headings.length > 0 ? headings[0].text : null;
      const title = heading || `Pages 1\u2013${Math.max(totalPages, 1)}`;
      sections.push({
        text: trimmed,
        title,
        startPage: 1,
        endPage: Math.max(totalPages, 1),
        estMinutes: Math.max(1, Math.ceil(trimmed.split(/\s+/).length / 180)),
      });
    }
  }

  return sections;
}

module.exports = { extractPdfSections };
