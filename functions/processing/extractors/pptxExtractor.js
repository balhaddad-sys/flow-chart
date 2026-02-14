/**
 * @module processing/extractors/pptxExtractor
 * @description Splits a PPTX file into slide-range sections with extracted text.
 */

const JSZip = require("jszip");
const fs = require("fs");
const { SLIDES_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Extract text from a PPTX file and split into sections.
 * PPTX files are ZIP archives containing XML slide files.
 * @param {string} filePath - Path to the PPTX file on disk
 * @returns {Array<{text: string, title: string, startSlide: number, endSlide: number, estMinutes: number}>}
 */
async function extractPptxSections(filePath) {
  // Use async I/O to avoid blocking the event loop
  const buffer = await fs.promises.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);

  // Extract text from each slide
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1]);
      const numB = parseInt(b.match(/slide(\d+)/)[1]);
      return numA - numB;
    });

  // Extract all slides in parallel instead of sequentially
  const slideTexts = await Promise.all(
    slideFiles.map(async (slideFile) => {
      const xml = await zip.file(slideFile).async("text");
      const texts = [];
      const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g);
      for (const match of matches) {
        texts.push(match[1]);
      }
      return texts.join(" ");
    })
  );

  // Chunk into sections
  const sections = [];
  let startSlide = 1;

  while (startSlide <= slideTexts.length) {
    const endSlide = Math.min(
      startSlide + SLIDES_PER_SECTION - 1,
      slideTexts.length
    );
    const text = slideTexts
      .slice(startSlide - 1, endSlide)
      .join("\n\n")
      .trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      sections.push({
        text,
        title: `Slides ${startSlide}\u2013${endSlide}`,
        startSlide,
        endSlide,
        estMinutes: Math.ceil((endSlide - startSlide + 1) * 2),
      });
    }

    startSlide = endSlide + 1;
  }

  // Ensure short slide decks still produce at least one section.
  if (sections.length === 0) {
    const merged = slideTexts.join("\n\n").trim();
    if (merged.length > 0) {
      sections.push({
        text: merged,
        title: `Slides 1\u2013${Math.max(slideTexts.length, 1)}`,
        startSlide: 1,
        endSlide: Math.max(slideTexts.length, 1),
        estMinutes: Math.max(1, Math.ceil(Math.max(slideTexts.length, 1) * 2)),
      });
    }
  }

  return sections;
}

module.exports = { extractPptxSections };
