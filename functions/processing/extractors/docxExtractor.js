/**
 * @module processing/extractors/docxExtractor
 * @description Splits a DOCX file into word-count sections with extracted text.
 */

const mammoth = require("mammoth");
const fs = require("fs");
const { WORDS_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Extract text from a DOCX file and split into sections.
 * Uses mammoth for reliable DOCX text extraction.
 * @param {string} filePath - Path to the DOCX file on disk
 * @returns {Array<{text: string, title: string, startWord: number, endWord: number, estMinutes: number}>}
 */
async function extractDocxSections(filePath) {
  // Use async I/O to avoid blocking the event loop
  const buffer = await fs.promises.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  const fullText = result.value;

  const words = fullText.split(/\s+/).filter((w) => w.length > 0);
  const totalWords = words.length;

  const sections = [];
  let startWord = 0;

  while (startWord < totalWords) {
    const endWord = Math.min(startWord + WORDS_PER_SECTION, totalWords);
    const text = words.slice(startWord, endWord).join(" ").trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      const sectionNum = sections.length + 1;
      sections.push({
        text,
        title: `Section ${sectionNum} (words ${startWord + 1}\u2013${endWord})`,
        startWord: startWord + 1,
        endWord,
        estMinutes: Math.ceil((endWord - startWord) / 150),
      });
    }

    startWord = endWord;
  }

  return sections;
}

module.exports = { extractDocxSections };
