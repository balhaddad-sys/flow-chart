/**
 * @module lib/serialize
 * @description Serialization helpers for normalising AI responses.
 *
 * Claude returns field names in `snake_case` to match the prompt schema, but
 * Firestore documents and the Flutter client use `camelCase`.  This module
 * provides explicit, schema-aware transformers so that the mapping is defined
 * in one place rather than scattered across every consumer.
 */

/**
 * Transform a raw AI blueprint response into the Firestore schema.
 *
 * @param {object} raw - The parsed JSON from Claude's blueprint generation.
 * @returns {{ title: string, difficulty: number, estMinutes: number, topicTags: string[], blueprint: object }}
 */
function normaliseBlueprint(raw) {
  return {
    title: raw.title || "",
    difficulty: raw.difficulty || 3,
    estMinutes: raw.estimated_minutes || 15,
    topicTags: raw.topic_tags || [],
    blueprint: {
      learningObjectives: raw.learning_objectives || [],
      keyConcepts:        raw.key_concepts || [],
      highYieldPoints:    raw.high_yield_points || [],
      commonTraps:        raw.common_traps || [],
      termsToDefine:      raw.terms_to_define || [],
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

  return {
    topicTags:    Array.isArray(raw.tags) ? raw.tags.slice(0, 10) : (defaults.topicTags || []),
    difficulty:   Math.min(5, Math.max(1, raw.difficulty || 3)),
    type:         "SBA",
    stem:         truncate(raw.stem, 2000),
    options:      raw.options.slice(0, 8).map((o) => truncate(o, 500)),
    correctIndex: Math.min(raw.options.length - 1, Math.max(0, raw.correct_index)),
    explanation: {
      correctWhy:    truncate(raw.explanation?.correct_why, 1000),
      whyOthersWrong: truncate(raw.explanation?.why_others_wrong, 2000),
      keyTakeaway:   truncate(raw.explanation?.key_takeaway, 500),
    },
    sourceRef: {
      fileId:    defaults.fileId,
      sectionId: defaults.sectionId,
      label:     truncate(raw.source_ref?.sectionLabel || defaults.sectionTitle, 200),
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
  if (!tutor.correct_answer && !tutor.why_correct) return null;

  return {
    correctAnswer:  tutor.correct_answer || "",
    whyCorrect:     tutor.why_correct || "",
    whyStudentWrong: tutor.why_student_wrong || "",
    keyTakeaway:    tutor.key_takeaway || "",
    followUps:      Array.isArray(tutor.follow_ups)
      ? tutor.follow_ups.map((f) => ({ q: f.q || "", a: f.a || "" }))
      : [],
  };
}

module.exports = { normaliseBlueprint, normaliseQuestion, normaliseTutorResponse };
