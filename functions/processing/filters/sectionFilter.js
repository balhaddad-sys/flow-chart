/**
 * @module processing/filters/sectionFilter
 * @description Filter out non-instructional chunks (editorial/front matter).
 */

const OPENING_MARKERS = [
  /\btable of contents\b/i,
  /^\s*contents\b/i,
  /^\s*editorial\b/i,
  /\bletter to the editor\b/i,
  /^\s*correspondence\b/i,
  /\babout this issue\b/i,
  /\bin this issue\b/i,
  /\bnews (and|&) views\b/i,
  /\bmasthead\b/i,
  /\badvertisement\b/i,
  /\bsponsored content\b/i,
];

const METADATA_MARKERS = [
  /\bcopyright\b/i,
  /\ball rights reserved\b/i,
  /\bpermissions?\b/i,
  /\bsubscription\b/i,
  /\bissn\b/i,
  /\bisbn\b/i,
  /\bdoi\b/i,
  /\blibrary of congress\b/i,
  /\bcataloging[- ]in[- ]publication\b/i,
  /\bprinted in\b/i,
  /\baddress inquiries\b/i,
  /\breproduced in whole or in part\b/i,
];

const MEDICAL_HINTS = [
  /\bdiagnos(is|tic)\b/i,
  /\btreat(ment|ing)\b/i,
  /\bmanagement\b/i,
  /\bclinical\b/i,
  /\bpathophysiolog(y|ic)\b/i,
  /\bsymptom(s)?\b/i,
  /\bprognos(is|tic)\b/i,
  /\bguideline(s)?\b/i,
  /\bdifferential\b/i,
  /\bmedication(s)?\b/i,
];

function countMatches(text, patterns) {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

/**
 * Decide if a section is analyzable educational content.
 *
 * @param {{ title?: string, text?: string }} section
 * @returns {{ include: boolean, score: number, reason: string }}
 */
function evaluateSectionForAnalysis(section) {
  const title = String(section?.title || "").trim();
  const text = String(section?.text || "").trim();
  const opening = text.slice(0, 1500);

  const openingHits = countMatches(opening, OPENING_MARKERS);
  const metadataHits = countMatches(opening, METADATA_MARKERS);
  const medicalHits = countMatches(text.slice(0, 2500), MEDICAL_HINTS);
  const titleHit = /\b(editorial|letter|correspondence|contents|masthead)\b/i.test(title) ? 1 : 0;

  // Positive score means likely non-instructional.
  const score = openingHits * 3 + metadataHits + titleHit * 2 - Math.min(3, medicalHits);

  if (text.length < 120) {
    return { include: false, score: 99, reason: "Section text too short" };
  }
  if (openingHits >= 2) {
    return { include: false, score, reason: "Editorial/front-matter markers detected" };
  }
  // Heavy metadata with little medical content → title/copyright page
  if (metadataHits >= 3 && medicalHits <= 1) {
    return { include: false, score, reason: "Copyright/title page detected" };
  }
  if (score >= 3) {
    return { include: false, score, reason: "Low instructional signal" };
  }
  return { include: true, score, reason: "Instructional section" };
}

/**
 * Filter non-instructional sections before AI analysis.
 *
 * @param {Array<{ title?: string, text?: string }>} sections
 * @returns {{
 *   keptSections: Array<object>,
 *   droppedSections: Array<{ index: number, title: string, score: number, reason: string }>
 * }}
 */
function filterAnalyzableSections(sections) {
  const keptSections = [];
  const droppedSections = [];

  for (const [index, section] of (sections || []).entries()) {
    const decision = evaluateSectionForAnalysis(section);
    if (decision.include) {
      keptSections.push(section);
      continue;
    }
    droppedSections.push({
      index,
      title: String(section?.title || `Section ${index + 1}`),
      score: decision.score,
      reason: decision.reason,
    });
  }

  return { keptSections, droppedSections };
}

module.exports = {
  evaluateSectionForAnalysis,
  filterAnalyzableSections,
};

