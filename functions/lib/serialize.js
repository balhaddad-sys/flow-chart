/**
 * @module lib/serialize
 * @description Serialization helpers for normalising AI responses.
 *
 * Claude returns field names in `snake_case` to match the prompt schema, but
 * Firestore documents and the Flutter client use `camelCase`.  This module
 * provides explicit, schema-aware transformers so that the mapping is defined
 * in one place rather than scattered across every consumer.
 *
 * SECURITY: All text fields are sanitized before storage to prevent stored XSS.
 */

const { sanitizeText, sanitizeArray } = require("./sanitize");
const { truncate } = require("./utils");

function normaliseCitationSource(rawSource) {
  const source = String(rawSource || "").toLowerCase().trim();
  if (source.includes("pubmed")) return "PubMed";
  if (source.includes("uptodate") || source.includes("up to date")) return "UpToDate";
  if (source.includes("medscape")) return "Medscape";
  return "PubMed";
}

/**
 * Build a working search URL for a given source and topic.
 * Always uses search endpoints so links are guaranteed to work.
 */
function buildSearchUrl(source, topic) {
  const query = encodeURIComponent(String(topic || "medical topic").slice(0, 120));
  switch (source) {
    case "UpToDate":
      return `https://www.uptodate.com/contents/search?search=${query}`;
    case "Medscape":
      return `https://www.medscape.com/search?queryText=${query}`;
    case "PubMed":
    default:
      return `https://pubmed.ncbi.nlm.nih.gov/?term=${query}`;
  }
}

function buildCitationFallbacks(stem, topicTags) {
  const topic = String(topicTags?.[0] || stem || "medical topic")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
  return [
    { source: "PubMed", title: `PubMed: ${topic}`, url: buildSearchUrl("PubMed", topic) },
    { source: "UpToDate", title: `UpToDate: ${topic}`, url: buildSearchUrl("UpToDate", topic) },
    { source: "Medscape", title: `Medscape: ${topic}`, url: buildSearchUrl("Medscape", topic) },
  ];
}

function normaliseCitations(rawCitations, { stem, topicTags }) {
  const citations = [];
  const seenTitles = new Set();
  const input = Array.isArray(rawCitations) ? rawCitations.slice(0, 8) : [];

  for (const item of input) {
    if (!item) continue;
    const rawTitle = sanitizeText(item.title || item.label || "");
    if (!rawTitle) continue;

    const source = normaliseCitationSource(item.source, "");
    const title = truncate(rawTitle, 250);

    const key = `${source}:${title.toLowerCase()}`;
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);

    citations.push({
      source,
      title,
      url: buildSearchUrl(source, rawTitle),
    });

    if (citations.length >= 3) break;
  }

  if (citations.length > 0) return citations;
  return buildCitationFallbacks(stem, topicTags);
}

/**
 * Transform a raw AI blueprint response into the Firestore schema.
 *
 * @param {object} raw - The parsed JSON from Claude's blueprint generation.
 * @returns {{ title: string, difficulty: number, estMinutes: number, topicTags: string[], blueprint: object }}
 */
function normaliseBlueprint(raw) {
  // Handle both snake_case (prompt schema) and camelCase (Gemini sometimes returns)
  return {
    title: sanitizeText(raw.title) || "",
    difficulty: raw.difficulty || 3,
    estMinutes: raw.estimated_minutes || raw.estimatedMinutes || 15,
    topicTags: sanitizeArray(raw.topic_tags || raw.topicTags || []),
    blueprint: {
      learningObjectives: sanitizeArray(raw.learning_objectives || raw.learningObjectives || []),
      keyConcepts:        sanitizeArray(raw.key_concepts || raw.keyConcepts || []),
      highYieldPoints:    sanitizeArray(raw.high_yield_points || raw.highYieldPoints || []),
      commonTraps:        sanitizeArray(raw.common_traps || raw.commonTraps || []),
      termsToDefine:      sanitizeArray(raw.terms_to_define || raw.termsToDefine || []),
    },
  };
}

/**
 * Transform a raw AI question into the Firestore schema.
 *
 * @param {object} raw      - Single question object from Claude's response.
 * @param {object} defaults - Fallback values from the parent section.
 * @param {string} defaults.fileId
 * @param {string} [defaults.fileName]
 * @param {string} defaults.sectionId
 * @param {string} defaults.sectionTitle
 * @param {string[]} defaults.topicTags
 * @returns {object|null} Normalised question or `null` if structurally invalid.
 */
function normaliseQuestion(raw, defaults) {
  // Accept both snake_case and camelCase for correctIndex
  const correctIdx = raw.correct_index ?? raw.correctIndex;
  if (!raw.stem || !Array.isArray(raw.options) || correctIdx == null) {
    return null;
  }

  // Sanitize first, then truncate (safer - removes malicious content before length limiting)
  const options = raw.options.slice(0, 8).map((o) => truncate(sanitizeText(o), 500));
  const optionCount = options.length;

  // Accept both snake_case and camelCase for explanation fields
  const expl = raw.explanation || {};
  const whyOthersRaw = expl.why_others_wrong || expl.whyOthersWrong;

  // Ensure whyOthersWrong array matches number of options for safe indexing
  let whyOthersWrong = [];
  if (Array.isArray(whyOthersRaw)) {
    whyOthersWrong = whyOthersRaw
      .slice(0, optionCount)
      .map(s => truncate(sanitizeText(s), 400));
  }
  // Pad with fallback text if AI didn't provide enough explanations
  while (whyOthersWrong.length < optionCount) {
    whyOthersWrong.push("This option is incorrect.");
  }

  const topicTags = sanitizeArray(
    Array.isArray(raw.tags || raw.topicTags) ? (raw.tags || raw.topicTags).slice(0, 10) : (defaults.topicTags || [])
  );
  const citations = normaliseCitations(raw.citations || expl.citations || raw.references, {
    stem: raw.stem,
    topicTags,
  });

  return {
    topicTags,
    difficulty:   Math.min(5, Math.max(1, raw.difficulty || 3)),
    type:         "SBA",
    stem:         truncate(sanitizeText(raw.stem), 2000),
    options,
    correctIndex: Math.min(options.length - 1, Math.max(0, correctIdx)),
    explanation: {
      correctWhy:    truncate(sanitizeText(expl.correct_why || expl.correctWhy), 1000),
      whyOthersWrong,
      keyTakeaway:   truncate(sanitizeText(expl.key_takeaway || expl.keyTakeaway), 500),
    },
    sourceRef: {
      fileId:    defaults.fileId,
      fileName:  truncate(sanitizeText(raw.source_ref?.fileName || raw.sourceRef?.fileName || defaults.fileName), 200),
      sectionId: defaults.sectionId,
      label:     truncate(sanitizeText(raw.source_ref?.sectionLabel || raw.sourceRef?.sectionLabel || defaults.sectionTitle), 200),
    },
    citations,
    stats: { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 },
  };
}

/**
 * Transform a raw AI tutor response into the Firestore schema.
 *
 * @param {object} raw - Parsed JSON from Claude's tutor response.
 * @returns {object|null} Normalised tutor data or `null` if malformed.
 */
function normaliseTutorResponse(raw) {
  if (!raw) return null;
  const tutor = raw.tutor || raw;
  if (!tutor || !tutor.correct_answer || !tutor.why_correct) return null;

  return {
    correctAnswer:  sanitizeText(tutor.correct_answer) || "",
    whyCorrect:     sanitizeText(tutor.why_correct) || "",
    whyStudentWrong: sanitizeText(tutor.why_student_wrong) || "",
    keyTakeaway:    sanitizeText(tutor.key_takeaway) || "",
    followUps:      Array.isArray(tutor.follow_ups)
      ? tutor.follow_ups.map((f) => ({ q: sanitizeText(f.q) || "", a: sanitizeText(f.a) || "" }))
      : [],
  };
}

module.exports = { normaliseBlueprint, normaliseQuestion, normaliseTutorResponse };
