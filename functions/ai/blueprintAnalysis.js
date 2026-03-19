/**
 * @module ai/blueprintAnalysis
 * @description Resilient section blueprint generation with multi-provider
 * fallback and a deterministic local safety net.
 */

const { generateBlueprint: claudeGenerateBlueprint } = require("./aiClient");
const { generateBlueprint: geminiGenerateBlueprint } = require("./geminiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt } = require("./prompts");
const { normaliseBlueprint } = require("../lib/serialize");
const { sanitizeText, stripOCRNoise } = require("../lib/sanitize");
const { clampInt, truncate, withTimeout } = require("../lib/utils");
const { evaluateSectionForAnalysis } = require("../processing/filters/sectionFilter");

const DEFAULT_PROVIDER_ORDER = Object.freeze(["claude", "gemini"]);
const PROVIDER_TIMEOUT_MS = Object.freeze({
  claude: 45_000,
  gemini: 35_000,
});

const GENERIC_TITLE_RE =
  /\b(?:pages?|slides?|section|chapter|part)\s*\d+(?:\s*(?:-|to)\s*\d+)?\b|\b(?:untitled|unknown\s+section)\b/i;
const NOISE_LINE_RE =
  /\b(?:copyright|all rights reserved|isbn|issn|doi|table of contents|library of congress|cataloging|printed in)\b/i;
const HEADING_BLACKLIST_RE =
  /^(?:summary|overview|introduction|background|key points?|learning objectives?|references?)$/i;
const COMPLEXITY_HINT_RE =
  /\b(?:pathophysiology|mechanism|differential|interpretation|algorithm|electrophysiology|pharmacology|contraindication|complication|hemodynamic|investigation)\b/i;
const TRAP_HINTS = [
  /\bdo not\b/i,
  /\bavoid\b/i,
  /\bexcept\b/i,
  /\bhowever\b/i,
  /\bwhereas\b/i,
  /\bversus\b/i,
  /\bvs\b/i,
  /\bconfus/i,
  /\bpitfall\b/i,
  /\btrap\b/i,
];
const HIGH_YIELD_HINTS = [
  /\bfirst[- ]line\b/i,
  /\bmanagement\b/i,
  /\btreatment\b/i,
  /\bdiagnos/i,
  /\binvestigation\b/i,
  /\bcomplication\b/i,
  /\brisk\b/i,
  /\bindicates?\b/i,
  /\brecommended\b/i,
  /\bacute\b/i,
  /\bchronic\b/i,
];
const ACRONYM_STOPWORDS = new Set([
  "AND",
  "THE",
  "FOR",
  "WITH",
  "FROM",
  "THIS",
  "THAT",
  "HAVE",
  "WILL",
  "PAGE",
  "PAGES",
]);

function looksGenericTitle(value) {
  const title = sanitizeText(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return true;
  const simplified = title.includes(":") ? title.split(":").pop().trim() : title;
  if (!simplified) return true;
  if (GENERIC_TITLE_RE.test(simplified)) return true;
  if (/^(?:section|topic|part)\s*[a-z0-9]+$/i.test(simplified)) return true;
  return false;
}

function dedupeList(values, { maxItems = 5, maxLen = 160, minLen = 4 } = {}) {
  const out = [];
  const seen = new Set();

  for (const raw of values || []) {
    const value = truncate(
      sanitizeText(String(raw || ""))
        .replace(/\s+/g, " ")
        .replace(/^[-:;,.()\s]+|[-:;,.()\s]+$/g, "")
        .trim(),
      maxLen
    );

    if (value.length < minLen) continue;

    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);

    if (out.length >= maxItems) break;
  }

  return out;
}

function countLetters(text) {
  return (String(text || "").match(/[A-Za-z]/g) || []).length;
}

function wordCount(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function toLines(text) {
  const out = [];
  const seen = new Set();

  for (const rawLine of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = sanitizeText(
      rawLine
        .replace(/^[\s>*\-]+/, "")
        .replace(/^\d+[\).:\-]?\s+/, "")
    )
      .replace(/\s+/g, " ")
      .trim();

    if (line.length < 6 || line.length > 220) continue;
    if (NOISE_LINE_RE.test(line)) continue;

    const nonSpaceLength = line.replace(/\s/g, "").length;
    if (nonSpaceLength === 0) continue;
    if (countLetters(line) / nonSpaceLength < 0.45) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  return out;
}

function toSentences(text) {
  const flat = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return [];

  const parts = flat.split(/(?<=[.!?])\s+(?=[A-Z0-9(])|(?<=;)\s+(?=[A-Z(])/);
  const out = [];
  const seen = new Set();

  for (const rawPart of parts) {
    const sentence = sanitizeText(rawPart).replace(/\s+/g, " ").trim();
    if (sentence.length < 25 || sentence.length > 280) continue;
    if (NOISE_LINE_RE.test(sentence)) continue;

    const nonSpaceLength = sentence.replace(/\s/g, "").length;
    if (nonSpaceLength === 0) continue;
    if (countLetters(sentence) / nonSpaceLength < 0.45) continue;

    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sentence);
  }

  return out;
}

function headingScore(line, index) {
  const words = wordCount(line);
  let score = 0;

  if (words >= 1 && words <= 8) score += 4;
  if (line.length <= 80) score += 2;
  if (!/[.!?]$/.test(line)) score += 2;
  if (index < 5) score += 5 - index;
  if (/[A-Z][a-z]/.test(line)) score += 1;
  if (looksGenericTitle(line)) score -= 8;
  if (HEADING_BLACKLIST_RE.test(line) || NOISE_LINE_RE.test(line)) score -= 10;

  return score;
}

function conceptPhraseFromText(value) {
  let text = sanitizeText(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || looksGenericTitle(text) || NOISE_LINE_RE.test(text)) return "";

  if (text.includes(":")) {
    const left = text.split(":")[0].trim();
    if (wordCount(left) >= 1 && wordCount(left) <= 8) {
      text = left;
    }
  }

  const clausePatterns = [
    /^(.{4,90}?)\s+(?:is|are|was|were|refers to|describes|includes|involves|presents|causes|results in|requires|consists of|leads to)\b/i,
    /^(.{4,90}?)\s*[-:]\s+/,
  ];

  for (const pattern of clausePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      text = match[1].trim();
      break;
    }
  }

  text = text.replace(/[.?!,;:]+$/g, "").trim();
  if (wordCount(text) < 1 || wordCount(text) > 8) return "";
  if (text.length < 4 || text.length > 90) return "";
  if (HEADING_BLACKLIST_RE.test(text)) return "";
  return truncate(text, 90);
}

function pickHeading(lines, sentences) {
  const ranked = lines
    .slice(0, 12)
    .map((line, index) => ({ line, score: headingScore(line, index) }))
    .sort((a, b) => b.score - a.score);

  if (ranked[0]?.score >= 6) {
    return ranked[0].line;
  }

  for (const sentence of sentences.slice(0, 4)) {
    const phrase = conceptPhraseFromText(sentence);
    if (phrase && !looksGenericTitle(phrase)) return phrase;
  }

  return "";
}

function extractConcepts(lines, sentences, title) {
  const candidates = [];

  if (title) candidates.push(title);
  for (const line of lines.slice(0, 18)) candidates.push(conceptPhraseFromText(line));
  for (const sentence of sentences.slice(0, 10)) candidates.push(conceptPhraseFromText(sentence));

  const concepts = dedupeList(candidates, { maxItems: 6, maxLen: 90, minLen: 4 });
  if (concepts.length > 0) return concepts;

  const fallback = sentences
    .slice(0, 3)
    .map((sentence) => truncate(sentence, 90));
  return dedupeList(fallback, { maxItems: 3, maxLen: 90, minLen: 20 });
}

function highYieldScore(sentence, index) {
  let score = Math.max(0, 6 - index);
  for (const pattern of HIGH_YIELD_HINTS) {
    if (pattern.test(sentence)) score += 2;
  }
  if (/\b[A-Z]{2,8}\b/.test(sentence)) score += 1;
  if (/\d/.test(sentence)) score += 1;
  if (sentence.length < 35) score -= 3;
  if (sentence.length > 240) score -= 1;
  return score;
}

function extractHighYieldPoints(sentences, concepts) {
  const ranked = sentences
    .map((sentence, index) => ({ sentence, score: highYieldScore(sentence, index) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.sentence);

  const points = dedupeList(ranked, { maxItems: 5, maxLen: 220, minLen: 20 });
  if (points.length > 0) return points;

  return dedupeList(
    concepts.map((concept) => `${concept} is a core topic in this section.`),
    { maxItems: 3, maxLen: 160, minLen: 20 }
  );
}

function normaliseTrapSentence(sentence) {
  const cleaned = sanitizeText(sentence || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
}

function extractCommonTraps(sentences, concepts) {
  const traps = dedupeList(
    sentences
      .filter((sentence) => TRAP_HINTS.some((pattern) => pattern.test(sentence)))
      .map(normaliseTrapSentence),
    { maxItems: 4, maxLen: 200, minLen: 20 }
  );

  if (traps.length > 0) return traps;
  if (concepts.length >= 2) {
    return [`Do not confuse ${concepts[0]} with ${concepts[1]} when answering questions from this section.`];
  }
  return [];
}

function extractTerms(text, concepts, title) {
  const terms = [];
  const acronyms = String(text || "").match(/\b[A-Z]{2,8}\b/g) || [];

  for (const acronym of acronyms) {
    if (ACRONYM_STOPWORDS.has(acronym)) continue;
    terms.push(acronym);
  }

  if (title && !looksGenericTitle(title) && wordCount(title) <= 4) terms.push(title);
  for (const concept of concepts) {
    if (wordCount(concept) <= 4) terms.push(concept);
  }

  return dedupeList(terms, { maxItems: 8, maxLen: 80, minLen: 2 });
}

function buildObjective(concept) {
  const topic = sanitizeText(concept || "").replace(/\s+/g, " ").trim();
  if (!topic) return "";

  if (/\b(?:management|treatment|therapy|algorithm|approach)\b/i.test(topic)) {
    return `Apply ${topic} to clinical decision-making.`;
  }
  if (/\b(?:diagnosis|diagnostic|differential|interpretation|assessment)\b/i.test(topic)) {
    return `Interpret the decisive findings in ${topic}.`;
  }
  if (/\b(?:versus|vs)\b/i.test(topic)) {
    return `Differentiate ${topic} in exam scenarios.`;
  }
  return `Explain the core principles of ${topic}.`;
}

function buildLearningObjectives(title, concepts, highYieldPoints) {
  const seed = concepts.length > 0 ? concepts : title ? [title] : [];
  const objectives = seed.slice(0, 3).map(buildObjective);

  if (highYieldPoints[0]) {
    const emphasis = conceptPhraseFromText(highYieldPoints[0]) || title;
    if (emphasis) {
      objectives.push(`Recognize the high-yield features of ${emphasis}.`);
    }
  }

  return dedupeList(objectives, { maxItems: 4, maxLen: 160, minLen: 12 });
}

function buildTopicTags(title, concepts, terms) {
  const candidates = [];

  if (title && !looksGenericTitle(title) && wordCount(title) <= 5) candidates.push(title);
  for (const concept of concepts) {
    if (wordCount(concept) <= 4) candidates.push(concept);
  }
  for (const term of terms) {
    if (wordCount(term) <= 3) candidates.push(term);
  }

  return dedupeList(candidates, { maxItems: 5, maxLen: 60, minLen: 2 });
}

function estimateMinutes(text) {
  const words = wordCount(text);
  const minutes = Math.round(words / 45);
  return clampInt(Math.max(10, minutes), 10, 60);
}

function estimateDifficulty(text, title) {
  let difficulty = 2;
  const words = wordCount(text);

  if (words > 250) difficulty += 1;
  if (words > 700) difficulty += 1;
  if (COMPLEXITY_HINT_RE.test(text)) difficulty += 1;
  if (/\b(?:overview|introduction|basic|fundamentals?)\b/i.test(title || "")) difficulty -= 1;

  return clampInt(difficulty, 1, 5);
}

function blueprintContentCount(normalised) {
  const bp = normalised?.blueprint || {};
  return (
    (bp.learningObjectives?.length || 0) +
    (bp.keyConcepts?.length || 0) +
    (bp.highYieldPoints?.length || 0) +
    (bp.commonTraps?.length || 0) +
    (bp.termsToDefine?.length || 0)
  );
}

function createEmptyBlueprint() {
  return normaliseBlueprint({
    title: "",
    difficulty: 1,
    estimated_minutes: 0,
    topic_tags: [],
    learning_objectives: [],
    key_concepts: [],
    high_yield_points: [],
    common_traps: [],
    terms_to_define: [],
  });
}

function buildHeuristicBlueprint({ sectionText }) {
  const cleaned = stripOCRNoise(String(sectionText || ""));
  const lines = toLines(cleaned);
  const sentences = toSentences(cleaned);
  const title = pickHeading(lines, sentences);
  const concepts = extractConcepts(lines, sentences, title);
  const highYieldPoints = extractHighYieldPoints(sentences, concepts);
  const commonTraps = extractCommonTraps(sentences, concepts);
  const termsToDefine = extractTerms(cleaned, concepts, title);
  const topicTags = buildTopicTags(title, concepts, termsToDefine);
  const learningObjectives = buildLearningObjectives(title, concepts, highYieldPoints);

  return normaliseBlueprint({
    title,
    difficulty: estimateDifficulty(cleaned, title),
    estimated_minutes: estimateMinutes(cleaned),
    topic_tags: topicTags,
    learning_objectives: learningObjectives,
    key_concepts: concepts,
    high_yield_points: highYieldPoints,
    common_traps: commonTraps,
    terms_to_define: termsToDefine,
  });
}

function mergeBlueprints(primary, fallback) {
  if (!primary) return fallback || createEmptyBlueprint();
  if (!fallback) return primary;

  return normaliseBlueprint({
    title: looksGenericTitle(primary.title) ? fallback.title : primary.title || fallback.title,
    difficulty: Math.max(primary.difficulty || 1, fallback.difficulty || 1),
    estimated_minutes: Math.max(primary.estMinutes || 0, fallback.estMinutes || 0),
    topic_tags: dedupeList(
      [...(primary.topicTags || []), ...(fallback.topicTags || [])],
      { maxItems: 5, maxLen: 60, minLen: 2 }
    ),
    learning_objectives: dedupeList(
      [
        ...(primary.blueprint?.learningObjectives || []),
        ...(fallback.blueprint?.learningObjectives || []),
      ],
      { maxItems: 6, maxLen: 160, minLen: 12 }
    ),
    key_concepts: dedupeList(
      [
        ...(primary.blueprint?.keyConcepts || []),
        ...(fallback.blueprint?.keyConcepts || []),
      ],
      { maxItems: 8, maxLen: 90, minLen: 4 }
    ),
    high_yield_points: dedupeList(
      [
        ...(primary.blueprint?.highYieldPoints || []),
        ...(fallback.blueprint?.highYieldPoints || []),
      ],
      { maxItems: 6, maxLen: 220, minLen: 20 }
    ),
    common_traps: dedupeList(
      [
        ...(primary.blueprint?.commonTraps || []),
        ...(fallback.blueprint?.commonTraps || []),
      ],
      { maxItems: 5, maxLen: 200, minLen: 20 }
    ),
    terms_to_define: dedupeList(
      [
        ...(primary.blueprint?.termsToDefine || []),
        ...(fallback.blueprint?.termsToDefine || []),
      ],
      { maxItems: 10, maxLen: 80, minLen: 2 }
    ),
  });
}

async function runBlueprintProvider(provider, systemPrompt, userPrompt) {
  const fn = provider === "gemini" ? geminiGenerateBlueprint : claudeGenerateBlueprint;
  const timeoutMs = PROVIDER_TIMEOUT_MS[provider] || 30_000;

  return withTimeout(
    fn(systemPrompt, userPrompt).catch((error) => ({
      success: false,
      error: error.message,
    })),
    timeoutMs,
    `${provider} blueprint`
  );
}

function normaliseProviderOrder(providerOrder) {
  const requested = Array.isArray(providerOrder) ? providerOrder : DEFAULT_PROVIDER_ORDER;
  const valid = requested.filter((provider) => provider === "claude" || provider === "gemini");
  return Array.from(new Set(valid.length > 0 ? valid : DEFAULT_PROVIDER_ORDER));
}

async function analyzeSectionBlueprint({
  fileName,
  sectionLabel,
  contentType,
  sectionText,
  providerOrder = DEFAULT_PROVIDER_ORDER,
}) {
  const cleanedText = stripOCRNoise(String(sectionText || ""));
  const heuristicDecision = evaluateSectionForAnalysis({
    title: sectionLabel,
    text: cleanedText,
  });

  if (!cleanedText || cleanedText.length < 80 || !heuristicDecision.include) {
    return {
      success: true,
      normalised: createEmptyBlueprint(),
      isNonInstructional: true,
      source: "heuristic",
      degraded: false,
      attempts: [],
      cleanedText,
    };
  }

  const heuristicBlueprint = buildHeuristicBlueprint({ sectionText: cleanedText });
  const fallbackHasContent = blueprintContentCount(heuristicBlueprint) > 0;
  const userPrompt = blueprintUserPrompt({
    fileName,
    sectionLabel,
    contentType,
    sectionText: cleanedText,
  });
  const attempts = [];

  for (const provider of normaliseProviderOrder(providerOrder)) {
    const result = await runBlueprintProvider(provider, BLUEPRINT_SYSTEM, userPrompt);
    const success = Boolean(result?.success && result?.data);
    attempts.push({
      provider,
      success,
      error: success ? null : result?.error || "Blueprint call failed",
    });

    if (!success) continue;

    const modelBlueprint = normaliseBlueprint(result.data);
    const mergedBlueprint = mergeBlueprints(modelBlueprint, heuristicBlueprint);

    if (blueprintContentCount(mergedBlueprint) > 0) {
      return {
        success: true,
        normalised: mergedBlueprint,
        isNonInstructional: false,
        source: provider,
        degraded: blueprintContentCount(modelBlueprint) === 0,
        attempts,
        cleanedText,
      };
    }
  }

  if (fallbackHasContent) {
    return {
      success: true,
      normalised: heuristicBlueprint,
      isNonInstructional: false,
      source: "heuristic",
      degraded: true,
      attempts,
      cleanedText,
    };
  }

  return {
    success: true,
    normalised: createEmptyBlueprint(),
    isNonInstructional: true,
    source: "heuristic",
    degraded: true,
    attempts,
    cleanedText,
  };
}

module.exports = {
  analyzeSectionBlueprint,
  buildHeuristicBlueprint,
  blueprintContentCount,
  createEmptyBlueprint,
  mergeBlueprints,
};
