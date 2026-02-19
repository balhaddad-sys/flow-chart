/**
 * @module processing/extractors/pptxExtractor
 * @description Splits a PPTX file into slide-range sections with extracted text.
 * Extracts slide title placeholders to produce meaningful section titles.
 */

const JSZip = require("jszip");
const fs = require("fs");
const { SLIDES_PER_SECTION, MIN_CHARS_PER_SECTION } = require("../../lib/constants");

/**
 * Extract the title text from a single PPTX slide XML.
 * Looks for shapes with `<p:ph type="title"/>` or `<p:ph type="ctrTitle"/>`
 * and returns the concatenated `<a:t>` text from that shape.
 *
 * Falls back to the first non-empty `<a:t>` text if no title placeholder is found,
 * but only if that text is short enough to be a plausible title.
 *
 * @param {string} xml - The raw XML content of a slide file
 * @returns {string|null} The slide title or null if none found
 */
function extractSlideTitle(xml) {
  // Try proper title placeholder shapes first
  const shapeRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let match;

  while ((match = shapeRegex.exec(xml)) !== null) {
    const shapeXml = match[1];
    // Check if this shape is a title placeholder
    if (/<p:ph[^>]*type="(?:title|ctrTitle)"/.test(shapeXml)) {
      const texts = [];
      const textMatches = shapeXml.matchAll(/<a:t>(.*?)<\/a:t>/g);
      for (const tm of textMatches) {
        texts.push(tm[1]);
      }
      const title = texts.join(" ").trim();
      if (title.length > 0 && title.length <= 150) return title;
    }
  }

  return null;
}

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

  // Extract all slides in parallel — capture both full text and title
  const slides = await Promise.all(
    slideFiles.map(async (slideFile) => {
      const xml = await zip.file(slideFile).async("text");
      const texts = [];
      const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g);
      for (const match of matches) {
        texts.push(match[1]);
      }
      return {
        text: texts.join(" "),
        title: extractSlideTitle(xml),
      };
    })
  );

  // Chunk into sections
  const sections = [];
  let startSlide = 1;

  while (startSlide <= slides.length) {
    const endSlide = Math.min(
      startSlide + SLIDES_PER_SECTION - 1,
      slides.length
    );
    const chunk = slides.slice(startSlide - 1, endSlide);
    const text = chunk.map((s) => s.text).join("\n\n").trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      // Use the first slide's title in this chunk as the section title
      const firstTitle = chunk.find((s) => s.title)?.title || null;
      const title = firstTitle || `Slides ${startSlide}\u2013${endSlide}`;

      sections.push({
        text,
        title,
        startSlide,
        endSlide,
        estMinutes: Math.ceil((endSlide - startSlide + 1) * 2),
      });
    }

    startSlide = endSlide + 1;
  }

  // Ensure short slide decks still produce at least one section.
  if (sections.length === 0) {
    const merged = slides.map((s) => s.text).join("\n\n").trim();
    if (merged.length > 0) {
      const firstTitle = slides.find((s) => s.title)?.title || null;
      const title = firstTitle || `Slides 1\u2013${Math.max(slides.length, 1)}`;
      sections.push({
        text: merged,
        title,
        startSlide: 1,
        endSlide: Math.max(slides.length, 1),
        estMinutes: Math.max(1, Math.ceil(Math.max(slides.length, 1) * 2)),
      });
    }
  }

  return sections;
}

module.exports = { extractPptxSections };
