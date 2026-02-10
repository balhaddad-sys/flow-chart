/**
 * @module processing/extractors/pdfExtractor
 * @description Splits a PDF file into page-range sections with extracted text.
 */

const pdfParse = require("pdf-parse");
const fs = require("fs");

const PAGES_PER_SECTION = 10;
const MIN_CHARS_PER_SECTION = 100;

/**
 * Extract text from a PDF file and split into sections.
 * @param {string} filePath - Path to the PDF file on disk
 * @returns {Array<{text: string, title: string, startPage: number, endPage: number, estMinutes: number}>}
 */
async function extractPdfSections(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const totalPages = data.numpages;
  const fullText = data.text;
  const charsPerPage = fullText.length / Math.max(totalPages, 1);

  const sections = [];
  let startPage = 1;

  while (startPage <= totalPages) {
    const endPage = Math.min(startPage + PAGES_PER_SECTION - 1, totalPages);
    const startChar = Math.floor((startPage - 1) * charsPerPage);
    const endChar = Math.floor(endPage * charsPerPage);
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

    startPage = endPage + 1;
  }

  return sections;
}

module.exports = { extractPdfSections };
