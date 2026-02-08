const JSZip = require("jszip");
const fs = require("fs");

const SLIDES_PER_SECTION = 20;
const MIN_CHARS_PER_SECTION = 100;

/**
 * Extract text from a PPTX file and split into sections.
 * PPTX files are ZIP archives containing XML slide files.
 * @param {string} filePath - Path to the PPTX file on disk
 * @returns {Array<{text: string, title: string, startSlide: number, endSlide: number, estMinutes: number}>}
 */
async function extractPptxSections(filePath) {
  const buffer = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(buffer);

  // Extract text from each slide
  const slideTexts = [];
  const slideFiles = Object.keys(zip.files)
    .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1]);
      const numB = parseInt(b.match(/slide(\d+)/)[1]);
      return numA - numB;
    });

  for (const slideFile of slideFiles) {
    const xml = await zip.file(slideFile).async("text");
    // Extract text content from XML (simple regex approach)
    const texts = [];
    const matches = xml.matchAll(/<a:t>(.*?)<\/a:t>/g);
    for (const match of matches) {
      texts.push(match[1]);
    }
    slideTexts.push(texts.join(" "));
  }

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

  return sections;
}

module.exports = { extractPptxSections };
