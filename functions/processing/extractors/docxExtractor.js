/**
 * @module processing/extractors/docxExtractor
 * @description Splits a DOCX file into word-count sections with extracted text.
 * Detects heading styles via mammoth HTML conversion to produce meaningful section titles.
 */

const mammoth = require("mammoth");
const fs = require("fs");
const { WORDS_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Extract headings from mammoth-generated HTML and map them to approximate
 * word offsets in the raw text.
 *
 * @param {string} html - HTML output from mammoth.convertToHtml()
 * @param {string} fullText - Raw text from mammoth.extractRawText()
 * @returns {Array<{ text: string, wordOffset: number }>}
 */
function extractHeadingsWithOffsets(html, fullText) {
  const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    // Strip inner HTML tags (e.g. <strong>, <em>) to get plain text
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text.length >= 2 && text.length <= 150) {
      headings.push(text);
    }
  }

  // Map each heading to its approximate word offset in the raw text
  const result = [];
  let searchFromChar = 0;

  for (const heading of headings) {
    const idx = fullText.indexOf(heading, searchFromChar);
    if (idx === -1) continue; // heading text not found in raw text, skip

    // Count words before this char offset
    const textBefore = fullText.slice(0, idx);
    const wordOffset = textBefore.split(/\s+/).filter((w) => w.length > 0).length;

    result.push({ text: heading, wordOffset });
    searchFromChar = idx + heading.length;
  }

  return result;
}

/**
 * Extract text from a DOCX file and split into sections.
 * Uses mammoth for reliable DOCX text extraction and HTML conversion
 * to detect heading styles for meaningful section titles.
 *
 * @param {string} filePath - Path to the DOCX file on disk
 * @returns {Array<{text: string, title: string, startWord: number, endWord: number, estMinutes: number}>}
 */
async function extractDocxSections(filePath) {
  const buffer = await fs.promises.readFile(filePath);

  // Extract both raw text and HTML in parallel
  const [textResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }),
  ]);

  const fullText = textResult.value;
  const html = htmlResult.value;

  const words = fullText.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;

  // Detect headings and their word-offset positions
  const headings = extractHeadingsWithOffsets(html, fullText);

  const sections = [];
  let startWord = 0;

  while (startWord < totalWords) {
    const endWord = Math.min(startWord + WORDS_PER_SECTION, totalWords);
    const text = words.slice(startWord, endWord).join(" ").trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      // Find the first heading within this section's word range
      const heading = headings.find(
        (h) => h.wordOffset >= startWord && h.wordOffset < endWord
      );
      const sectionNum = sections.length + 1;
      const title = heading
        ? heading.text
        : `Section ${sectionNum} (words ${startWord + 1}\u2013${endWord})`;

      sections.push({
        text,
        title,
        startWord: startWord + 1,
        endWord,
        estMinutes: Math.ceil((endWord - startWord) / 150),
      });
    }

    startWord = endWord;
  }

  // Ensure short documents still produce at least one section.
  if (sections.length === 0) {
    const trimmed = fullText.trim();
    if (trimmed.length > 0) {
      const heading = headings.length > 0 ? headings[0].text : null;
      const title = heading || `Section 1 (words 1\u2013${Math.max(totalWords, 1)})`;
      sections.push({
        text: trimmed,
        title,
        startWord: 1,
        endWord: Math.max(totalWords, 1),
        estMinutes: Math.max(1, Math.ceil(Math.max(totalWords, 1) / 150)),
      });
    }
  }

  return sections;
}

module.exports = { extractDocxSections };
