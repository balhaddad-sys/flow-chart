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
const { QUESTION_QUALITY, QUESTION_CONFIDENCE_THRESHOLD } = require("./constants");

const GENERIC_BLUEPRINT_TITLE_RE =
  /\b(?:pages?|slides?|section|chapter|part)\s*\d+(?:\s*(?:-|–|—|to)\s*\d+)?\b|\b(?:untitled|unknown\s+section)\b/i;
const LEADING_OBJECTIVE_VERB_RE =
  /^(?:understand|describe|explain|identify|recogni[sz]e|differentiate|evaluate|apply|outline|review|summari[sz]e|know)\s+/i;

function cleanTitleCandidate(value, maxLen = 160) {
  return truncate(sanitizeText(value), maxLen)
    .replace(/\s+/g, " ")
    .replace(/^[-:;,.()\s]+|[-:;,.()\s]+$/g, "")
    .trim();
}

function isGenericBlueprintTitle(value) {
  const title = cleanTitleCandidate(value, 220);
  if (!title) return true;
  if (GENERIC_BLUEPRINT_TITLE_RE.test(title)) return true;
  if (/^(?:section|topic|part)\s*[a-z0-9]+$/i.test(title)) return true;
  return false;
}

function objectiveToTopic(value) {
  return cleanTitleCandidate(value, 160)
    .replace(LEADING_OBJECTIVE_VERB_RE, "")
    .replace(/^the\s+/i, "")
    .replace(/[.?!].*$/, "")
    .trim();
}

function pushUniqueTitleCandidate(out, seen, value) {
  const candidate = objectiveToTopic(value);
  if (!candidate || isGenericBlueprintTitle(candidate)) return;

  const key = candidate.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(candidate);
}

function deriveBlueprintTitle(rawTitle, topicTags, blueprint) {
  const title = cleanTitleCandidate(rawTitle, 200);
  if (title && !isGenericBlueprintTitle(title)) return title;

  const candidates = [];
  const seen = new Set();

  for (const tag of topicTags.slice(0, 5)) pushUniqueTitleCandidate(candidates, seen, tag);
  for (const concept of blueprint.keyConcepts.slice(0, 4)) pushUniqueTitleCandidate(candidates, seen, concept);
  for (const term of blueprint.termsToDefine.slice(0, 4)) pushUniqueTitleCandidate(candidates, seen, term);
  for (const objective of blueprint.learningObjectives.slice(0, 3)) pushUniqueTitleCandidate(candidates, seen, objective);
  for (const point of blueprint.highYieldPoints.slice(0, 2)) pushUniqueTitleCandidate(candidates, seen, point);

  if (candidates.length > 0) {
    const primary = candidates[0];
    const secondary = candidates.find((value) => value.toLowerCase() !== primary.toLowerCase());
    return truncate(secondary ? `${primary} - ${secondary}` : primary, 200);
  }

  return title || "";
}

function normaliseCitationSource(rawSource) {
  const source = String(rawSource || "").toLowerCase().trim();
  if (source.includes("pubmed")) return "PubMed";
  if (source.includes("uptodate") || source.includes("up to date")) return "UpToDate";
  if (source.includes("medscape")) return "Medscape";
  return "PubMed";
}

/**
 * Extract a PMID from a citation title if present.
 * Supports formats like "Article Title (PMID: 12345678)", "PMID: 12345678", "PMID 12345678"
 */
function extractPmid(title) {
  const match = String(title || "").match(/PMID[:\s]*(\d{6,9})/i);
  return match ? match[1] : null;
}

/**
 * Build a working URL for a given source and topic.
 * Uses direct PMID links when a valid PMID is found in the title.
 * Otherwise falls back to search endpoints so links are guaranteed to work.
 */
function buildSearchUrl(source, topic) {
  const topicStr = String(topic || "medical topic");

  // If source is PubMed and a PMID is embedded, link directly to the article
  if (source === "PubMed" || !source) {
    const pmid = extractPmid(topicStr);
    if (pmid) {
      return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    }
  }

  const query = encodeURIComponent(topicStr.slice(0, 120));
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
    { source: "PubMed", title: `PubMed: ${topic}`, url: buildSearchUrl("PubMed", topic), verified: false },
    { source: "UpToDate", title: `UpToDate: ${topic}`, url: buildSearchUrl("UpToDate", topic), verified: false },
    { source: "Medscape", title: `Medscape: ${topic}`, url: buildSearchUrl("Medscape", topic), verified: false },
  ];
}

/**
 * Normalise a raw year value into a valid 4-digit year or null.
 */
function normaliseGuidelineYear(rawYear) {
  if (rawYear == null) return null;
  const currentYear = new Date().getFullYear();
  const minYear = Math.max(1990, currentYear - 30);
  const maxYear = currentYear + 1;

  if (typeof rawYear === "number" && Number.isFinite(rawYear)) {
    const year = Math.floor(rawYear);
    return year >= minYear && year <= maxYear ? year : null;
  }

  const rawText = String(rawYear || "").trim();
  const match = rawText.match(/\b(19|20)\d{2}\b/);
  if (!match) return null;
  const year = Number(match[0]);
  return year >= minYear && year <= maxYear ? year : null;
}

/**
 * Compute a 0–1 confidence score based on citation quality and evidence references.
 */
function computeConfidenceScore(citationMeta, raw) {
  let score = 0.5;
  if (citationMeta.evidenceQuality === "HIGH") score += 0.15;
  else if (citationMeta.evidenceQuality === "MODERATE") score += 0.08;
  if (citationMeta.hasPmid) score += 0.10;
  if (citationMeta.hasNamedGuideline) score += 0.08;
  if (!citationMeta.fallbackUsed) score += 0.07;

  // Check if explanations reference named guidelines/trials
  const expl = raw.explanation || {};
  const explText = [
    expl.correct_why || expl.correctWhy || "",
    expl.key_takeaway || expl.keyTakeaway || "",
  ].join(" ");
  const guidelinePattern = /\b(NICE|AHA|ACC|ESC|BTS|SIGN|WHO|RCOG|USPSTF|Cochrane|BMJ|NEJM|Lancet|CRASH|PARADIGM|SPRINT|HOPE|SAVE)\b/i;
  if (guidelinePattern.test(explText)) score += 0.05;

  return Math.min(1, Math.round(score * 100) / 100);
}

function buildCitationMeta(citations) {
  const safe = Array.isArray(citations) ? citations : [];
  const uniqueSources = Array.from(new Set(
    safe.map((c) => String(c?.source || "").trim()).filter(Boolean)
  ));
  const fallbackUsed = safe.some((c) =>
    /^(PubMed|UpToDate|Medscape):/i.test(String(c?.title || ""))
  );
  const trustedSourceCount = uniqueSources.length;

  // Check if any citations have real PMIDs (indicates high-quality specific references)
  const hasPmid = safe.some((c) => extractPmid(c?.title));

  // Check if citations reference named guidelines or trials (evidence of specificity)
  const guidelinePattern = /\b(NICE|AHA|ACC|ESC|BTS|SIGN|WHO|RCOG|USPSTF|Cochrane|BMJ|NEJM|Lancet)\b/i;
  const hasNamedGuideline = safe.some((c) => guidelinePattern.test(String(c?.title || "")));

  let evidenceQuality = "LOW";
  if (!fallbackUsed && safe.length >= 3 && trustedSourceCount >= 2) {
    evidenceQuality = "HIGH";
  } else if (!fallbackUsed && (hasPmid || hasNamedGuideline) && safe.length >= 2) {
    evidenceQuality = "HIGH";
  } else if (safe.length >= 2) {
    evidenceQuality = "MODERATE";
  }

  return {
    trustedSourceCount,
    uniqueSources,
    citationCount: safe.length,
    fallbackUsed,
    hasPmid,
    hasNamedGuideline,
    evidenceQuality,
  };
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
      verified: !!extractPmid(rawTitle),
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
  // Unwrap if Gemini returned an array instead of an object
  // e.g. [{ title: ..., learning_objectives: [...] }]
  let unwrapped = raw;
  if (Array.isArray(raw)) {
    unwrapped = raw[0] && typeof raw[0] === "object" ? raw[0] : {};
  }

  // Unwrap if Gemini wrapped the response in an extra object
  // e.g. { blueprint: { title: ..., learning_objectives: [...] } }
  const data = unwrapped.blueprint && typeof unwrapped.blueprint === "object" && !Array.isArray(unwrapped.blueprint)
    ? unwrapped.blueprint
    : unwrapped;

  const topicTags = sanitizeArray(data.topic_tags || data.topicTags || unwrapped.topic_tags || unwrapped.topicTags || []);
  const blueprint = {
    learningObjectives: sanitizeArray(data.learning_objectives || data.learningObjectives || []),
    keyConcepts:        sanitizeArray(data.key_concepts || data.keyConcepts || []),
    highYieldPoints:    sanitizeArray(data.high_yield_points || data.highYieldPoints || []),
    commonTraps:        sanitizeArray(data.common_traps || data.commonTraps || []),
    termsToDefine:      sanitizeArray(data.terms_to_define || data.termsToDefine || []),
  };

  // Handle both snake_case (prompt schema) and camelCase (Gemini sometimes returns)
  return {
    title: deriveBlueprintTitle(data.title || unwrapped.title, topicTags, blueprint),
    difficulty: data.difficulty || unwrapped.difficulty || 3,
    estMinutes: data.estimated_minutes || data.estimatedMinutes || unwrapped.estimated_minutes || unwrapped.estimatedMinutes || 15,
    topicTags,
    blueprint,
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
  const citationMeta = buildCitationMeta(citations);

  // Compute evidence-based confidence score and quality tier
  const confidenceScore = computeConfidenceScore(citationMeta, raw);
  const quality = confidenceScore >= QUESTION_CONFIDENCE_THRESHOLD
    ? QUESTION_QUALITY.NORMAL
    : QUESTION_QUALITY.DRAFT;

  // Extract source-level quotes from the AI response
  const sourceCitations = (raw.source_quotes || raw.sourceQuotes || [])
    .slice(0, 3)
    .map((sq) => ({
      fileId: defaults.fileId,
      chunkId: defaults.sectionId,
      pageNumber: Number.isInteger(sq?.page_or_slide ?? sq?.pageOrSlide) ? (sq.page_or_slide ?? sq.pageOrSlide) : null,
      slideIndex: null,
      quote: truncate(sanitizeText(sq?.quote || ""), 300),
    }))
    .filter((sc) => sc.quote);

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
    sourceCitations,
    citations,
    citationMeta,
    confidenceScore,
    quality,
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

module.exports = {
  normaliseBlueprint,
  normaliseQuestion,
  normaliseTutorResponse,
  normaliseCitationSource,
  buildSearchUrl,
  extractPmid,
  normaliseGuidelineYear,
};
