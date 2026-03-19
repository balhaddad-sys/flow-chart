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
/**
 * Clean common pdf-parse artifacts from heading text:
 * - Trailing page numbers glued to text (e.g. "Anatomy of the Heart12" → "Anatomy of the Heart")
 * - Leading/trailing whitespace and punctuation
 */
function cleanHeadingText(text) {
  return text
    .replace(/(?<=[a-zA-Z])\d{1,4}$/, "") // strip trailing digits concatenated to letters
    .replace(/^\s+|\s+$/g, "");
}

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
      const cleaned = cleanHeadingText(line);
      if (cleaned.length >= 3) {
        headings.push({ text: cleaned, charOffset });
      }
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

  // Build per-page character boundaries using page break markers.
  // pdf-parse inserts form feed (\f) between pages in many PDFs.
  // If page breaks are present, use them for accurate boundaries;
  // otherwise fall back to proportional estimation.
  const pageBreaks = [];
  let searchFrom = 0;
  for (let i = 0; i < totalPages - 1; i++) {
    const ffIdx = fullText.indexOf("\f", searchFrom);
    if (ffIdx === -1) break;
    pageBreaks.push(ffIdx);
    searchFrom = ffIdx + 1;
  }

  const hasRealPageBreaks = pageBreaks.length >= totalPages * 0.5;

  // Build char offset for each page boundary
  const pageCharOffsets = [0]; // page 1 starts at char 0
  if (hasRealPageBreaks) {
    for (const brk of pageBreaks) {
      pageCharOffsets.push(brk + 1); // skip the \f character
    }
  } else {
    // Fallback: proportional estimation (existing behavior, clearly marked)
    const charsPerPage = fullText.length / Math.max(totalPages, 1);
    for (let p = 1; p < totalPages; p++) {
      pageCharOffsets.push(Math.floor(p * charsPerPage));
    }
  }
  pageCharOffsets.push(fullText.length); // end sentinel

  // Detect heading-like lines so sections get meaningful titles
  const headings = detectHeadings(fullText);

  // ── Heading-aware segmentation ──
  // Instead of fixed PAGES_PER_SECTION windows, use detected headings as
  // natural section boundaries. Fall back to page-window splitting when
  // headings are sparse (< 2 for the document).
  const sections = [];
  const droppedPages = [];

  // Build heading page map: heading -> page number
  const headingPages = headings.map((h) => {
    // Find which page this heading falls on
    let page = 1;
    for (let p = 0; p < pageCharOffsets.length - 1; p++) {
      if (h.charOffset >= pageCharOffsets[p] && h.charOffset < (pageCharOffsets[p + 1] ?? fullText.length)) {
        page = p + 1;
        break;
      }
    }
    return { ...h, page };
  });

  const useHeadingBoundaries = headingPages.length >= 2;

  if (useHeadingBoundaries) {
    // Split at each heading boundary
    for (let i = 0; i < headingPages.length; i++) {
      const heading = headingPages[i];
      const nextHeading = headingPages[i + 1];
      const startPage = heading.page;
      const endPage = nextHeading ? Math.max(startPage, nextHeading.page - 1) : totalPages;

      // Cap very long sections at PAGES_PER_SECTION and split
      if (endPage - startPage + 1 > PAGES_PER_SECTION * 2) {
        // Split into roughly equal parts
        let subStart = startPage;
        while (subStart <= endPage) {
          const subEnd = Math.min(subStart + PAGES_PER_SECTION - 1, endPage);
          const startChar = pageCharOffsets[subStart - 1] ?? 0;
          const rawEndChar = pageCharOffsets[subEnd] ?? fullText.length;
          const endChar = subEnd === totalPages ? fullText.length : snapToBreak(fullText, rawEndChar);
          const text = fullText.slice(startChar, endChar).trim();

          if (text.length >= MIN_CHARS_PER_SECTION) {
            sections.push({
              text,
              title: subStart === startPage ? heading.text : `${heading.text} (cont.)`,
              startPage: subStart,
              endPage: subEnd,
              estMinutes: Math.ceil((subEnd - subStart + 1) * 3),
            });
          } else {
            droppedPages.push({ startPage: subStart, endPage: subEnd, textLength: text.length });
          }
          subStart = subEnd + 1;
        }
      } else {
        const startChar = pageCharOffsets[startPage - 1] ?? 0;
        const rawEndChar = pageCharOffsets[endPage] ?? fullText.length;
        const endChar = endPage === totalPages ? fullText.length : snapToBreak(fullText, rawEndChar);
        const text = fullText.slice(startChar, endChar).trim();

        if (text.length >= MIN_CHARS_PER_SECTION) {
          sections.push({
            text,
            title: heading.text,
            startPage,
            endPage,
            estMinutes: Math.ceil((endPage - startPage + 1) * 3),
          });
        } else {
          droppedPages.push({ startPage, endPage, textLength: text.length });
        }
      }
    }

    // Handle pages before the first heading
    if (headingPages[0].page > 1) {
      const preStart = 1;
      const preEnd = headingPages[0].page - 1;
      const startChar = pageCharOffsets[preStart - 1] ?? 0;
      const endChar = pageCharOffsets[preEnd] ?? fullText.length;
      const text = fullText.slice(startChar, snapToBreak(fullText, endChar)).trim();
      if (text.length >= MIN_CHARS_PER_SECTION) {
        sections.unshift({
          text,
          title: `Introduction (Pages 1\u2013${preEnd})`,
          startPage: preStart,
          endPage: preEnd,
          estMinutes: Math.ceil(preEnd * 3),
        });
      }
    }
  } else {
    // Fallback: fixed page-window splitting (sparse/no headings)
    let startPage = 1;
    while (startPage <= totalPages) {
      const endPage = Math.min(startPage + PAGES_PER_SECTION - 1, totalPages);
      const startChar = pageCharOffsets[startPage - 1] ?? 0;
      const rawEndChar = pageCharOffsets[endPage] ?? fullText.length;
      const endChar = endPage === totalPages ? fullText.length : snapToBreak(fullText, rawEndChar);
      const text = fullText.slice(startChar, endChar).trim();

      if (text.length >= MIN_CHARS_PER_SECTION) {
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
      } else {
        droppedPages.push({ startPage, endPage, textLength: text.length });
      }
      startPage = endPage + 1;
    }
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

  // Log dropped pages as a warning so ops can monitor extraction quality
  if (droppedPages.length > 0) {
    const log = require("../../lib/logger");
    log.warn("PDF extraction dropped page ranges with insufficient text", {
      droppedPages,
      totalPages,
      sectionsExtracted: sections.length,
      usedRealPageBreaks: hasRealPageBreaks,
    });
  }

  return sections;
}

module.exports = { extractPdfSections };
