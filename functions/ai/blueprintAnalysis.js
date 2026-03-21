/**
 * @module ai/blueprintAnalysis
 * @description Resilient section blueprint generation with a comprehensive
 * local heuristic, multi-provider AI fallback, and intelligent merging.
 *
 * The heuristic is designed to produce good-enough blueprints for clean,
 * well-structured text (textbooks, slides, typed notes). For OCR'd or
 * noisy text it should gracefully degrade and let the AI take over.
 *
 * Pipeline: evaluate → heuristic → (optional AI) → merge → normalise
 */

const { generateBlueprint: claudeGenerateBlueprint } = require("./aiClient");
const { generateBlueprint: geminiGenerateBlueprint } = require("./geminiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt } = require("./prompts");
const { normaliseBlueprint } = require("../lib/serialize");
const { sanitizeText, stripOCRNoise } = require("../lib/sanitize");
const { clampInt, truncate, withTimeout } = require("../lib/utils");
const { evaluateSectionForAnalysis } = require("../processing/filters/sectionFilter");

// ─── Provider config ────────────────────────────────────────────────────────
const DEFAULT_PROVIDER_ORDER = Object.freeze(["gemini", "claude"]);
const PROVIDER_TIMEOUT_MS = Object.freeze({ claude: 45_000, gemini: 35_000 });

// ─── Medical domain knowledge ───────────────────────────────────────────────

/** Real medical acronyms we should keep (not OCR noise). */
const MEDICAL_ACRONYMS = new Set([
  "ABG", "ACE", "ACLS", "ACS", "ADH", "AF", "AKI", "ALS", "AMI", "ARDS",
  "ASA", "ASD", "ATLS", "AV", "BLS", "BMI", "BNP", "BP", "BPH", "CABG",
  "CBC", "CHF", "CKD", "CMP", "CNS", "COPD", "CPR", "CRP", "CSF", "CT",
  "CVA", "CVP", "CXR", "DIC", "DKA", "DM", "DVT", "ECG", "EEG", "EMG",
  "ENT", "ER", "ERCP", "ESR", "FBC", "GCS", "GFR", "GI", "GP", "GTN",
  "HB", "HBA1C", "HCG", "HDL", "HIV", "HR", "HTN", "IBD", "IBS", "ICU",
  "IM", "INR", "IV", "IVF", "JVP", "KUB", "LA", "LDL", "LFT", "LMP",
  "LP", "LV", "LVH", "MAP", "MCI", "MI", "MRA", "MRI", "MRSA", "MS",
  "NICE", "NSAID", "OCP", "OD", "OR", "PA", "PCI", "PCR", "PE", "PFT",
  "PID", "PMH", "PO", "PPE", "PPI", "PR", "PT", "PTH", "PTT", "PV",
  "RA", "RBC", "RF", "RR", "SA", "SBP", "SC", "SLE", "SOB", "STI",
  "SVT", "TB", "TBSA", "TFT", "TIA", "TIMI", "TPN", "TSH", "TTE",
  "U&E", "UA", "USS", "UTI", "VF", "VSD", "VT", "VTE", "WBC", "WHO",
  // Triage-specific
  "RED", "YELLOW", "GREEN", "BLACK", "ASAP", "PRIMARY", "SECONDARY",
]);

/** Words that look like acronyms but aren't medical terms. */
const ACRONYM_STOPWORDS = new Set([
  "AND", "THE", "FOR", "WITH", "FROM", "THIS", "THAT", "HAVE", "WILL",
  "PAGE", "PAGES", "ARE", "WAS", "WERE", "HAS", "HAD", "NOT", "BUT",
  "CAN", "MAY", "ALL", "ITS", "HIS", "HER", "OUR", "ANY", "NEW",
  "ONE", "TWO", "USE", "SEE", "GET", "SET", "PUT", "LET", "RUN",
  "END", "ADD", "TRY", "ASK", "SAY", "OLD", "BIG", "FEW", "OWN",
]);

/** Patterns that indicate a line is a structural heading. */
const HEADING_PATTERNS = [
  /^\d+[\.)]\s+[A-Z]/,                          // "1. Introduction" or "1) Causes"
  /^(?:Chapter|Section|Part|Unit)\s+\d/i,        // "Chapter 3"
  /^[A-Z][A-Z\s&/-]{4,60}$/,                     // "AIRWAY MANAGEMENT" (all-caps heading)
  /^[A-Z][a-z]+(?:\s+[A-Za-z&/-]+){0,6}$/,       // "Cardiac Arrest" (title-case, short)
  /^(?:Definition|Epidemiology|Etiology|Aetiology|Pathophysiology|Pathology|Clinical Features|Signs and Symptoms|Diagnosis|Investigations?|Management|Treatment|Prognosis|Complications?|Prevention|Summary|Key Points?)\b/i,
];

/** Lines matching these are noise, not content. */
const NOISE_LINE_RE =
  /\b(?:copyright|all rights reserved|isbn|issn|doi|table of contents|library of congress|cataloging|printed in|published by|reprinted with|permission granted)\b/i;

/** Medical content signal words — if text has many of these, it's educational. */
const MEDICAL_SIGNAL_WORDS = [
  /\bdiagnos(?:is|tic|e)\b/i,
  /\btreat(?:ment|ed|ing)\b/i,
  /\bmanagement\b/i,
  /\bclinical(?:ly)?\b/i,
  /\bpathophysiolog(?:y|ical)\b/i,
  /\bsymptom(?:s|atic)?\b/i,
  /\bprognos(?:is|tic)\b/i,
  /\bdifferential\b/i,
  /\bmedication(?:s)?\b/i,
  /\bpharmacolog(?:y|ical)\b/i,
  /\bantibiotic(?:s)?\b/i,
  /\bsurg(?:ery|ical)\b/i,
  /\banaesthes(?:ia|tic)\b/i,
  /\banaes?thesia\b/i,
  /\bradiology\b/i,
  /\bhistolog(?:y|ical)\b/i,
  /\banatom(?:y|ical)\b/i,
  /\bphysiolog(?:y|ical)\b/i,
  /\bcontraindication(?:s)?\b/i,
  /\bside[- ]effect(?:s)?\b/i,
  /\bmechanism\b/i,
  /\breceptor(?:s)?\b/i,
  /\bpresentation\b/i,
  /\bacute\b/i,
  /\bchronic\b/i,
  /\bemergency\b/i,
  /\btriage\b/i,
  /\bresuscitation\b/i,
  /\bhaemorrhage\b/i,
  /\bhemorrhage\b/i,
  /\bfracture(?:s)?\b/i,
  /\binfection(?:s)?\b/i,
  /\binflammation\b/i,
  /\bneoplasm(?:s)?\b/i,
  /\btumou?r(?:s)?\b/i,
  /\bmalignant\b/i,
  /\bbenign\b/i,
  /\bautoimmune\b/i,
  /\bimmunolog(?:y|ical)\b/i,
  /\bguideline(?:s)?\b/i,
  /\bevidence[- ]based\b/i,
  /\brandomised\b/i,
  /\brandomized\b/i,
  /\bmortality\b/i,
  /\bmorbidity\b/i,
  /\bincidence\b/i,
  /\bprevalence\b/i,
  /\bpediatric\b/i,
  /\bpaediatric\b/i,
  /\bneonatal\b/i,
  /\bobstetric\b/i,
  /\bgynaecolog/i,
  /\bgynecolog/i,
];

/** Complexity markers for difficulty estimation. */
const COMPLEXITY_HINTS = [
  /\bpathophysiology\b/i,
  /\bmechanism(?:s)?\b/i,
  /\bdifferential\s+diagnos/i,
  /\binterpretation\b/i,
  /\balgorithm\b/i,
  /\belectrophysiology\b/i,
  /\bpharmacokinet/i,
  /\bpharmacodynam/i,
  /\bcontraindication\b/i,
  /\bcomplication(?:s)?\b/i,
  /\bhemodynamic\b/i,
  /\bhaemodynamic\b/i,
  /\binvestigation(?:s)?\b/i,
  /\bmulti[- ]?organ\b/i,
  /\bsepsis\b/i,
  /\bdisseminated\b/i,
];

/** Trap/pitfall signal patterns. */
const TRAP_HINTS = [
  /\bdo not\b/i, /\bavoid\b/i, /\bnever\b/i, /\bexcept\b/i,
  /\bhowever\b/i, /\bwhereas\b/i, /\bversus\b/i, /\bvs\.?\b/i,
  /\bconfus(?:ed|ing)\b/i, /\bpitfall\b/i, /\btrap\b/i,
  /\bmistak(?:e|en)\b/i, /\bfallacy\b/i, /\bmisdiagnos/i,
  /\bcontrary\b/i, /\bdespite\b/i, /\balthough\b/i,
  /\bcommon(?:ly)?\s+(?:missed|confused|mistaken|overlooked)\b/i,
  /\brule\s+out\b/i, /\bexclud(?:e|ing)\b/i,
];

/** High-yield signal patterns. */
const HIGH_YIELD_HINTS = [
  /\bfirst[- ]line\b/i, /\bgold[- ]standard\b/i,
  /\bmanagement\b/i, /\btreatment\b/i,
  /\bdiagnos(?:is|tic)\b/i, /\binvestigation\b/i,
  /\bcomplication\b/i, /\brisk\s+factor/i,
  /\bindicates?\b/i, /\brecommended\b/i,
  /\bacute\b/i, /\bemergency\b/i,
  /\bmost\s+(?:common|likely|important)\b/i,
  /\bclassic(?:al)?\s+(?:presentation|finding|sign|triad)\b/i,
  /\bpathognomonic\b/i, /\bcharacteristic\b/i,
  /\bimmediate(?:ly)?\b/i, /\burgent(?:ly)?\b/i,
  /\b(?:Grade|Class|Stage|Type)\s+[IVX\d]+\b/i,
  /\b\d+%\b/,  // Statistics
  /\bmortality\b/i, /\bsurvival\b/i,
  /\bguideline\b/i, /\bprotocol\b/i,
];

// ─── Text quality assessment ────────────────────────────────────────────────

/**
 * Score how "clean" and structured text is.
 * Returns 0–100 where 100 = perfectly clean typed text.
 */
function textQualityScore(rawText, cleanedText) {
  const raw = String(rawText || "");
  const clean = String(cleanedText || "");
  if (!clean || clean.length < 50) return 0;

  let score = 50; // Start neutral

  // Noise ratio: how much did stripping remove?
  const noiseRatio = (raw.length - clean.length) / Math.max(1, raw.length);
  if (noiseRatio < 0.03) score += 15;       // Very clean
  else if (noiseRatio < 0.08) score += 8;   // Mostly clean
  else if (noiseRatio > 0.20) score -= 15;  // Very noisy
  else if (noiseRatio > 0.12) score -= 8;   // Noisy

  // Letter ratio: real text is mostly letters
  const letters = (clean.match(/[A-Za-z]/g) || []).length;
  const letterRatio = letters / Math.max(1, clean.length);
  if (letterRatio > 0.70) score += 10;
  else if (letterRatio < 0.45) score -= 15;

  // Average word length: OCR garbage has very short/long "words"
  const words = clean.split(/\s+/).filter(Boolean);
  const avgWordLen = words.reduce((sum, w) => sum + w.length, 0) / Math.max(1, words.length);
  if (avgWordLen >= 3.5 && avgWordLen <= 8) score += 8;
  else if (avgWordLen < 2.5 || avgWordLen > 12) score -= 10;

  // Sentence structure: proper sentences end with periods
  const sentences = clean.split(/[.!?]+/).filter((s) => s.trim().length > 15);
  const sentenceRatio = sentences.length / Math.max(1, words.length / 15);
  if (sentenceRatio > 0.5) score += 8;
  else if (sentenceRatio < 0.15) score -= 8;

  // Medical signal words: educational content has these
  const medicalHits = MEDICAL_SIGNAL_WORDS.filter((p) => p.test(clean)).length;
  score += Math.min(12, medicalHits * 2);

  // Gibberish detection: high ratio of non-dictionary patterns
  const gibberishWords = words.filter((w) =>
    w.length > 3 &&
    /[A-Za-z]/.test(w) &&
    !/^[A-Z]{2,8}$/.test(w) &&  // Not an acronym
    /[a-z][A-Z]/.test(w) &&      // camelCase fusion
    !/(?:Mc|Mac|De|Van)[A-Z]/.test(w)  // Not a name prefix
  ).length;
  const gibberishRatio = gibberishWords / Math.max(1, words.length);
  if (gibberishRatio > 0.05) score -= 15;

  return clampInt(score, 0, 100);
}

// ─── Text parsing ───────────────────────────────────────────────────────────

function wordCount(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function countLetters(text) {
  return (String(text || "").match(/[A-Za-z]/g) || []).length;
}

/**
 * Parse text into clean, deduplicated lines.
 * Filters out noise, very short lines, and non-textual content.
 */
function parseLines(text) {
  const out = [];
  const seen = new Set();

  for (const rawLine of String(text || "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = sanitizeText(
      rawLine
        .replace(/^[\s>*\-•●○■□▪▸]+/, "")   // Strip bullet chars
        .replace(/^\d+[\.):\-]?\s+/, "")      // Strip numbered list prefixes
    ).replace(/\s+/g, " ").trim();

    if (line.length < 6 || line.length > 300) continue;
    if (NOISE_LINE_RE.test(line)) continue;

    // Skip lines that are mostly non-letters (tables of numbers, etc.)
    const nonSpace = line.replace(/\s/g, "").length;
    if (nonSpace === 0) continue;
    if (countLetters(line) / nonSpace < 0.40) continue;

    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }

  return out;
}

/**
 * Extract proper sentences from text.
 * Handles multi-line content, lists, and medical formatting.
 */
function parseSentences(text) {
  const flat = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return [];

  // Split on sentence boundaries: period/question/exclamation followed by
  // space and capital letter, or semicolon followed by capital letter
  const parts = flat.split(/(?<=[.!?])\s+(?=[A-Z0-9(])|(?<=;)\s+(?=[A-Z(])/);
  const out = [];
  const seen = new Set();

  for (const rawPart of parts) {
    const sentence = sanitizeText(rawPart).replace(/\s+/g, " ").trim();
    if (sentence.length < 20 || sentence.length > 350) continue;
    if (NOISE_LINE_RE.test(sentence)) continue;

    const nonSpace = sentence.replace(/\s/g, "").length;
    if (nonSpace === 0) continue;
    if (countLetters(sentence) / nonSpace < 0.40) continue;

    const key = sentence.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sentence);
  }

  return out;
}

// ─── Deduplication helper ───────────────────────────────────────────────────

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

    // Skip if this is a substring of something already included
    let isSubstring = false;
    for (const existing of seen) {
      if (existing.includes(key) || key.includes(existing)) {
        isSubstring = true;
        break;
      }
    }
    if (isSubstring) continue;

    seen.add(key);
    out.push(value);

    if (out.length >= maxItems) break;
  }

  return out;
}

// ─── Title extraction ───────────────────────────────────────────────────────

/** Check if a value looks like a generic/garbage title. */
function looksGenericTitle(value) {
  const title = sanitizeText(value || "").replace(/\s+/g, " ").trim();
  if (!title || title.length < 3) return true;

  // Page/section references
  if (/\b(?:pages?|slides?|section|chapter|part)\s*\d+(?:\s*(?:-|to)\s*\d+)?\b/i.test(title)) return true;
  if (/^(?:section|topic|part)\s*[a-z0-9]+$/i.test(title)) return true;
  if (/^(?:untitled|unknown\s+section)$/i.test(title)) return true;

  // ISBN-style numeric prefixes
  if (/^\d{10,}/.test(title)) return true;

  // Pure numbers or single characters
  if (/^\d+$/.test(title)) return true;
  if (title.length <= 2) return true;

  return false;
}

/**
 * Score a line as a potential section heading.
 * Higher = more likely to be a good title.
 */
function headingScore(line, index) {
  let score = 0;
  const words = wordCount(line);

  // Length characteristics of headings
  if (words >= 2 && words <= 8) score += 5;
  else if (words === 1 && line.length >= 5) score += 2;
  else if (words > 10) score -= 3;

  if (line.length <= 80) score += 2;
  if (line.length > 120) score -= 3;

  // Headings don't end with periods
  if (!/[.!?]$/.test(line)) score += 2;

  // Position: earlier lines are more likely headings
  if (index === 0) score += 5;
  else if (index < 3) score += 4 - index;
  else if (index < 6) score += 1;

  // Matches known heading patterns
  for (const pattern of HEADING_PATTERNS) {
    if (pattern.test(line)) { score += 4; break; }
  }

  // Has medical terms → good sign for a topic title
  const medHits = MEDICAL_SIGNAL_WORDS.filter((p) => p.test(line)).length;
  score += Math.min(4, medHits * 2);

  // Penalties
  if (looksGenericTitle(line)) score -= 10;
  if (NOISE_LINE_RE.test(line)) score -= 10;

  return score;
}

/**
 * Extract the best title from parsed content.
 * Tries heading scoring first, then falls back to concept phrases.
 */
function extractTitle(lines, sentences) {
  // Score all candidate lines from the first 15 lines
  const ranked = lines
    .slice(0, 15)
    .map((line, index) => ({ line, score: headingScore(line, index) }))
    .sort((a, b) => b.score - a.score);

  // Use the best scoring line if it's clearly a heading
  if (ranked[0]?.score >= 7) {
    // Clean up: remove numbering prefixes, trailing colons
    let title = ranked[0].line
      .replace(/^\d+[\.)]\s+/, "")
      .replace(/:\s*$/, "")
      .trim();

    // Truncate very long titles to the key phrase
    if (wordCount(title) > 8) {
      const colonSplit = title.split(":");
      if (colonSplit.length > 1 && wordCount(colonSplit[0]) <= 6) {
        title = colonSplit[0].trim();
      } else {
        // Take first 8 words
        title = title.split(/\s+/).slice(0, 8).join(" ");
      }
    }

    return title;
  }

  // Fallback: extract a concept phrase from early sentences
  for (const sentence of sentences.slice(0, 6)) {
    const phrase = extractConceptPhrase(sentence);
    if (phrase && phrase.length >= 5 && !looksGenericTitle(phrase)) {
      return phrase;
    }
  }

  return "";
}

// ─── Concept extraction ─────────────────────────────────────────────────────

/**
 * Extract a concise concept phrase from a sentence.
 * Looks for the "subject" part before common verbs.
 */
function extractConceptPhrase(value) {
  let text = sanitizeText(value || "").replace(/\s+/g, " ").trim();
  if (!text || looksGenericTitle(text) || NOISE_LINE_RE.test(text)) return "";

  // If text has a colon, the part before it is often the concept
  if (text.includes(":")) {
    const left = text.split(":")[0].trim();
    if (wordCount(left) >= 1 && wordCount(left) <= 8 && left.length >= 4) {
      text = left;
    }
  }

  // Extract subject before common verbs
  const subjectPatterns = [
    /^(.{4,100}?)\s+(?:is|are|was|were|refers? to|describes?|includes?|involves?|presents?|causes?|results? in|requires?|consists? of|leads? to|occurs? (?:when|in|due)|defined as|characterised by|characterized by)\b/i,
    /^(.{4,100}?)\s*[-–—]\s+/,
  ];

  for (const pattern of subjectPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      text = match[1].trim();
      break;
    }
  }

  // Clean up
  text = text.replace(/[.?!,;:]+$/g, "").trim();

  // Validate
  if (wordCount(text) < 1 || wordCount(text) > 8) return "";
  if (text.length < 4 || text.length > 100) return "";
  if (looksGenericTitle(text)) return "";

  return truncate(text, 100);
}

/**
 * Extract key concepts from the parsed content.
 * Uses multiple strategies: heading analysis, sentence parsing,
 * medical term detection, and definition patterns.
 */
function extractConcepts(lines, sentences, title) {
  const candidates = [];

  // 1. Title is usually the primary concept
  if (title && !looksGenericTitle(title)) {
    candidates.push(title);
  }

  // 2. Extract concept phrases from early lines (often subheadings)
  for (const line of lines.slice(0, 20)) {
    const phrase = extractConceptPhrase(line);
    if (phrase) candidates.push(phrase);
  }

  // 3. Definition patterns: "X is defined as", "X refers to"
  for (const sentence of sentences.slice(0, 15)) {
    const defMatch = sentence.match(
      /^(.{4,80}?)\s+(?:is\s+(?:defined\s+as|a|an|the)|refers?\s+to|describes?|means?)\b/i
    );
    if (defMatch?.[1]) {
      const concept = defMatch[1].replace(/^(?:The|A|An)\s+/i, "").trim();
      if (concept.length >= 4 && wordCount(concept) <= 6) {
        candidates.push(concept);
      }
    }
  }

  // 4. Lines that look like subheadings (short, no period, title-case or all-caps)
  for (const line of lines.slice(0, 25)) {
    if (wordCount(line) >= 1 && wordCount(line) <= 5 &&
        line.length <= 60 && !/[.!?]$/.test(line) &&
        !NOISE_LINE_RE.test(line) && !looksGenericTitle(line)) {
      candidates.push(line);
    }
  }

  // 5. Concept phrases from sentences
  for (const sentence of sentences.slice(0, 12)) {
    candidates.push(extractConceptPhrase(sentence));
  }

  const concepts = dedupeList(
    candidates.filter(Boolean),
    { maxItems: 8, maxLen: 100, minLen: 4 }
  );

  if (concepts.length > 0) return concepts;

  // Fallback: use first few meaningful sentences truncated
  return dedupeList(
    sentences.slice(0, 3).map((s) => truncate(s, 100)),
    { maxItems: 3, maxLen: 100, minLen: 15 }
  );
}

// ─── High-yield point extraction ────────────────────────────────────────────

function highYieldScore(sentence, index) {
  let score = Math.max(0, 8 - index);

  for (const pattern of HIGH_YIELD_HINTS) {
    if (pattern.test(sentence)) score += 2;
  }

  // Contains statistics or numbers → likely factual/high-yield
  if (/\b\d+\s*%\b/.test(sentence)) score += 3;
  if (/\b\d+\s*(?:mg|ml|mmol|mcg|units?|hours?|days?|weeks?|months?|years?)\b/i.test(sentence)) score += 2;

  // Contains medical acronyms → likely important
  const acronyms = sentence.match(/\b[A-Z]{2,8}\b/g) || [];
  const medicalAcronymCount = acronyms.filter((a) => MEDICAL_ACRONYMS.has(a)).length;
  score += Math.min(3, medicalAcronymCount);

  // Length penalties
  if (sentence.length < 30) score -= 4;
  if (sentence.length > 280) score -= 2;

  // Sentence quality: starts with capital, ends with period
  if (/^[A-Z]/.test(sentence)) score += 1;
  if (/[.!]$/.test(sentence)) score += 1;

  return score;
}

function extractHighYieldPoints(sentences, concepts) {
  const ranked = sentences
    .map((sentence, index) => ({ sentence, score: highYieldScore(sentence, index) }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .map(({ sentence }) => sentence);

  const points = dedupeList(ranked, { maxItems: 6, maxLen: 250, minLen: 20 });

  if (points.length > 0) return points;

  // Fallback: use the most information-dense sentences
  const fallback = sentences
    .filter((s) => s.length >= 40 && wordCount(s) >= 6)
    .slice(0, 3);
  return dedupeList(fallback, { maxItems: 3, maxLen: 200, minLen: 20 });
}

// ─── Common trap extraction ─────────────────────────────────────────────────

function extractCommonTraps(sentences, concepts) {
  // Find sentences containing trap/pitfall language
  const trapSentences = sentences.filter((sentence) =>
    TRAP_HINTS.some((pattern) => pattern.test(sentence))
  );

  const traps = dedupeList(
    trapSentences.map((s) => {
      const cleaned = sanitizeText(s).replace(/\s+/g, " ").trim();
      return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
    }),
    { maxItems: 5, maxLen: 220, minLen: 15 }
  );

  if (traps.length > 0) return traps;

  // Generate synthetic traps from concepts if we have enough
  if (concepts.length >= 2) {
    return [`Do not confuse ${concepts[0]} with ${concepts[1]}.`];
  }
  return [];
}

// ─── Term extraction ────────────────────────────────────────────────────────

/**
 * Extract medical terms and acronyms worth defining.
 * Distinguishes real medical acronyms from OCR noise.
 */
function extractTerms(text, concepts, title) {
  const terms = [];
  const acronyms = String(text || "").match(/\b[A-Z]{2,8}\b/g) || [];

  for (const acronym of acronyms) {
    // Skip stopwords
    if (ACRONYM_STOPWORDS.has(acronym)) continue;

    // Prefer known medical acronyms
    if (MEDICAL_ACRONYMS.has(acronym)) {
      terms.push(acronym);
      continue;
    }

    // For unknown acronyms, require they appear at least twice
    // (real abbreviations are used repeatedly; OCR noise is random)
    const regex = new RegExp(`\\b${acronym}\\b`, "g");
    const matches = String(text || "").match(regex);
    if (matches && matches.length >= 2) {
      terms.push(acronym);
    }
  }

  // Add short concept phrases as terms
  if (title && !looksGenericTitle(title) && wordCount(title) <= 4) {
    terms.push(title);
  }
  for (const concept of concepts) {
    if (wordCount(concept) <= 4 && concept.length >= 4) {
      terms.push(concept);
    }
  }

  return dedupeList(terms, { maxItems: 10, maxLen: 80, minLen: 2 });
}

// ─── Learning objective generation ──────────────────────────────────────────

/**
 * Generate a learning objective from a concept.
 * Uses verb mapping based on the concept's domain.
 */
function buildObjective(concept) {
  const topic = sanitizeText(concept || "").replace(/\s+/g, " ").trim();
  if (!topic || topic.length < 4) return "";
  if (wordCount(topic) < 2 && !/^[A-Z]{2,8}$/.test(topic)) return "";
  if (looksGenericTitle(topic)) return "";

  // Map concept domain to appropriate Bloom's verb
  if (/\b(?:management|treatment|therapy|algorithm|approach|protocol)\b/i.test(topic)) {
    return `Apply ${topic} to clinical decision-making.`;
  }
  if (/\b(?:diagnosis|diagnostic|differential|interpretation|assessment|investigation)\b/i.test(topic)) {
    return `Interpret the decisive findings in ${topic}.`;
  }
  if (/\b(?:versus|vs|compared|comparison|distinction)\b/i.test(topic)) {
    return `Differentiate ${topic} in clinical scenarios.`;
  }
  if (/\b(?:classification|staging|grading|types?|categories)\b/i.test(topic)) {
    return `Classify ${topic} and recognize key distinctions.`;
  }
  if (/\b(?:mechanism|pathophysiology|pathogenesis|etiology|aetiology)\b/i.test(topic)) {
    return `Explain the underlying mechanism of ${topic}.`;
  }
  if (/\b(?:complication|prognosis|outcome|sequelae|risk)\b/i.test(topic)) {
    return `Identify the complications and prognostic factors of ${topic}.`;
  }
  if (/\b(?:emergency|acute|urgent|critical|resuscitation|triage)\b/i.test(topic)) {
    return `Recognize and manage ${topic} in an emergency setting.`;
  }
  if (/\b(?:prevention|screening|prophylaxis|vaccination|immunisation)\b/i.test(topic)) {
    return `Describe the preventive strategies for ${topic}.`;
  }

  return `Explain the core principles of ${topic}.`;
}

function buildLearningObjectives(title, concepts, highYieldPoints) {
  const seed = concepts.length > 0 ? concepts : title ? [title] : [];

  const objectives = seed
    .slice(0, 4)
    .map(buildObjective)
    .filter(Boolean);

  // Add a "recognize high-yield features" objective if we have HY points
  if (highYieldPoints.length > 0 && objectives.length < 5) {
    const firstHY = extractConceptPhrase(highYieldPoints[0]) || title;
    if (firstHY && !looksGenericTitle(firstHY)) {
      const hyObj = `Recognize the high-yield features of ${firstHY}.`;
      if (!objectives.some((o) => o.toLowerCase().includes(firstHY.toLowerCase()))) {
        objectives.push(hyObj);
      }
    }
  }

  return dedupeList(objectives, { maxItems: 5, maxLen: 160, minLen: 12 });
}

// ─── Topic tag generation ───────────────────────────────────────────────────

function buildTopicTags(title, concepts, terms) {
  const candidates = [];

  if (title && !looksGenericTitle(title) && wordCount(title) <= 5) {
    candidates.push(title);
  }
  for (const concept of concepts) {
    if (wordCount(concept) <= 4 && concept.length >= 3) candidates.push(concept);
  }
  for (const term of terms) {
    if (MEDICAL_ACRONYMS.has(term) || wordCount(term) <= 3) candidates.push(term);
  }

  return dedupeList(candidates, { maxItems: 5, maxLen: 60, minLen: 2 });
}

// ─── Metadata estimation ────────────────────────────────────────────────────

function estimateMinutes(text) {
  const words = wordCount(text);
  // Medical reading speed: ~40-50 words/minute with comprehension
  const minutes = Math.round(words / 45);
  return clampInt(Math.max(10, minutes), 10, 60);
}

function estimateDifficulty(text, title, concepts) {
  let difficulty = 2;
  const words = wordCount(text);

  // Length-based
  if (words > 300) difficulty += 1;
  if (words > 800) difficulty += 1;

  // Complexity keywords
  const complexityHits = COMPLEXITY_HINTS.filter((p) => p.test(text)).length;
  difficulty += Math.min(2, Math.floor(complexityHits / 2));

  // Simple intro topics
  if (/\b(?:overview|introduction|basic|fundamentals?|anatomy|definition)\b/i.test(title || "")) {
    difficulty -= 1;
  }

  // Advanced topic indicators in concepts
  const advancedConcepts = (concepts || []).filter((c) =>
    COMPLEXITY_HINTS.some((p) => p.test(c))
  ).length;
  if (advancedConcepts >= 2) difficulty += 1;

  return clampInt(difficulty, 1, 5);
}

// ─── Blueprint building ────────────────────────────────────────────────────

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

/**
 * Build a complete blueprint using deterministic heuristics.
 * No AI calls — purely text analysis.
 */
function buildHeuristicBlueprint({ sectionText }) {
  const cleaned = stripOCRNoise(String(sectionText || ""));
  const lines = parseLines(cleaned);
  const sentences = parseSentences(cleaned);

  const title = extractTitle(lines, sentences);
  const concepts = extractConcepts(lines, sentences, title);
  const highYieldPoints = extractHighYieldPoints(sentences, concepts);
  const commonTraps = extractCommonTraps(sentences, concepts);
  const termsToDefine = extractTerms(cleaned, concepts, title);
  const topicTags = buildTopicTags(title, concepts, termsToDefine);
  const learningObjectives = buildLearningObjectives(title, concepts, highYieldPoints);

  return normaliseBlueprint({
    title,
    difficulty: estimateDifficulty(cleaned, title, concepts),
    estimated_minutes: estimateMinutes(cleaned),
    topic_tags: topicTags,
    learning_objectives: learningObjectives,
    key_concepts: concepts,
    high_yield_points: highYieldPoints,
    common_traps: commonTraps,
    terms_to_define: termsToDefine,
  });
}

// ─── Blueprint merging ──────────────────────────────────────────────────────

/**
 * Merge two blueprints, preferring the primary but filling gaps from fallback.
 * Used when AI returns partial results and heuristic can supplement.
 */
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
      [...(primary.blueprint?.learningObjectives || []), ...(fallback.blueprint?.learningObjectives || [])],
      { maxItems: 6, maxLen: 160, minLen: 12 }
    ),
    key_concepts: dedupeList(
      [...(primary.blueprint?.keyConcepts || []), ...(fallback.blueprint?.keyConcepts || [])],
      { maxItems: 8, maxLen: 100, minLen: 4 }
    ),
    high_yield_points: dedupeList(
      [...(primary.blueprint?.highYieldPoints || []), ...(fallback.blueprint?.highYieldPoints || [])],
      { maxItems: 6, maxLen: 250, minLen: 20 }
    ),
    common_traps: dedupeList(
      [...(primary.blueprint?.commonTraps || []), ...(fallback.blueprint?.commonTraps || [])],
      { maxItems: 5, maxLen: 220, minLen: 15 }
    ),
    terms_to_define: dedupeList(
      [...(primary.blueprint?.termsToDefine || []), ...(fallback.blueprint?.termsToDefine || [])],
      { maxItems: 10, maxLen: 80, minLen: 2 }
    ),
  });
}

// ─── AI provider execution ──────────────────────────────────────────────────

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

// ─── Main analysis pipeline ─────────────────────────────────────────────────

/**
 * Analyze a section and produce a structured blueprint.
 *
 * Decision flow:
 * 1. Filter out non-instructional content (title pages, TOC, etc.)
 * 2. Run heuristic analysis
 * 3. Assess text quality and heuristic output quality
 * 4. If both are high quality → use heuristic (saves AI cost)
 * 5. Otherwise → call AI (Gemini first, Claude fallback)
 * 6. Merge AI result with heuristic for best coverage
 */
async function analyzeSectionBlueprint({
  fileName,
  sectionLabel,
  contentType,
  sectionText,
  providerOrder = DEFAULT_PROVIDER_ORDER,
}) {
  const cleanedText = stripOCRNoise(String(sectionText || ""));

  // Step 1: Filter non-instructional content
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

  // Step 2: Build heuristic blueprint
  const heuristicBlueprint = buildHeuristicBlueprint({ sectionText: cleanedText });
  const heuristicCount = blueprintContentCount(heuristicBlueprint);
  const fallbackHasContent = heuristicCount > 0;

  // Step 3: Assess quality to decide if we can skip AI
  const quality = textQualityScore(sectionText, cleanedText);
  const heuristicTitleOk = heuristicBlueprint.title
    && !looksGenericTitle(heuristicBlueprint.title)
    && heuristicBlueprint.title.length >= 6;

  // Step 4: Only skip AI when:
  // - Text quality is high (clean, well-structured)
  // - Heuristic produced a meaningful title
  // - Heuristic extracted enough content items
  // The threshold scales with quality: clean text needs fewer items
  const heuristicThreshold = quality >= 75 ? 10 : quality >= 55 ? 14 : 25;
  const canSkipAI = heuristicCount >= heuristicThreshold && heuristicTitleOk && quality >= 50;

  if (canSkipAI) {
    return {
      success: true,
      normalised: heuristicBlueprint,
      isNonInstructional: false,
      source: "heuristic",
      degraded: false,
      attempts: [{ provider: "heuristic", success: true, error: null, quality }],
      cleanedText,
    };
  }

  // Step 5: Call AI providers
  const userPrompt = blueprintUserPrompt({
    fileName,
    sectionLabel,
    contentType,
    sectionText: cleanedText,
  });
  const attempts = [{ provider: "heuristic", success: fallbackHasContent, error: null, quality }];

  for (const provider of normaliseProviderOrder(providerOrder)) {
    const result = await runBlueprintProvider(provider, BLUEPRINT_SYSTEM, userPrompt);
    const success = Boolean(result?.success && result?.data);
    attempts.push({
      provider,
      success,
      error: success ? null : result?.error || "Blueprint call failed",
    });

    if (!success) continue;

    // Step 6: Merge AI result with heuristic
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

  // Step 7: All AI providers failed — use heuristic as last resort
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
  // Exported for testing
  textQualityScore,
  looksGenericTitle,
  extractTitle,
  extractConcepts,
  extractConceptPhrase,
  headingScore,
};
