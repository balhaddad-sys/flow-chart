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

/**
 * Transform a raw AI blueprint response into the Firestore schema.
 *
 * @param {object} raw - The parsed JSON from Claude's blueprint generation.
 * @returns {{ title: string, difficulty: number, estMinutes: number, topicTags: string[], blueprint: object }}
 */
function normaliseBlueprint(raw) {
  return {
    title: sanitizeText(raw.title) || "",
    difficulty: raw.difficulty || 3,
    estMinutes: raw.estimated_minutes || 15,
    topicTags: sanitizeArray(raw.topic_tags || []),
    blueprint: {
      learningObjectives: sanitizeArray(raw.learning_objectives || []),
      keyConcepts:        sanitizeArray(raw.key_concepts || []),
      highYieldPoints:    sanitizeArray(raw.high_yield_points || []),
      commonTraps:        sanitizeArray(raw.common_traps || []),
      termsToDefine:      sanitizeArray(raw.terms_to_define || []),
    },
  };
}

/**
 * Transform a raw AI question into the Firestore schema.
 *
 * @param {object} raw      - Single question object from Claude's response.
 * @param {object} defaults - Fallback values from the parent section.
 * @param {string} defaults.fileId
 * @param {string} defaults.sectionId
 * @param {string} defaults.sectionTitle
 * @param {string[]} defaults.topicTags
 * @returns {object|null} Normalised question or `null` if structurally invalid.
 */
function normaliseQuestion(raw, defaults) {
  if (!raw.stem || !Array.isArray(raw.options) || raw.correct_index == null) {
    return null;
  }

  const { truncate } = require("./utils");

  // Sanitize first, then truncate (safer - removes malicious content before length limiting)
  const options = raw.options.slice(0, 8).map((o) => truncate(sanitizeText(o), 500));
  const optionCount = options.length;

  // Ensure whyOthersWrong array matches number of options for safe indexing
  let whyOthersWrong = [];
  if (Array.isArray(raw.explanation?.why_others_wrong)) {
    whyOthersWrong = raw.explanation.why_others_wrong
      .slice(0, optionCount)
      .map(s => truncate(sanitizeText(s), 400));
  }
  // Pad with fallback text if AI didn't provide enough explanations
  while (whyOthersWrong.length < optionCount) {
    whyOthersWrong.push("This option is incorrect.");
  }

  return {
    topicTags:    sanitizeArray(Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : (defaults.topicTags || [])),
    difficulty:   Math.min(5, Math.max(1, raw.difficulty || 3)),
    type:         "SBA",
    stem:         truncate(sanitizeText(raw.stem), 2000),
    options,
    correctIndex: Math.min(options.length - 1, Math.max(0, raw.correct_index)),
    explanation: {
      correctWhy:    truncate(sanitizeText(raw.explanation?.correct_why), 1000),
      whyOthersWrong,
      keyTakeaway:   truncate(sanitizeText(raw.explanation?.key_takeaway), 500),
    },
    sourceRef: {
      fileId:    defaults.fileId,
      sectionId: defaults.sectionId,
      label:     truncate(sanitizeText(raw.source_ref?.sectionLabel || defaults.sectionTitle), 200),
    },
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
  const tutor = raw?.tutor || raw;
  if (!tutor.correct_answer || !tutor.why_correct) return null;

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
