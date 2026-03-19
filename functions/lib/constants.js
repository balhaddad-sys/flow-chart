/**
 * @module lib/constants
 * @description Centralised constants for MedQ Cloud Functions.
 *
 * Every magic number, threshold, or configuration value used by more than one
 * module lives here so that changes propagate consistently and the codebase
 * stays easy to audit.
 */

// ── Firestore ────────────────────────────────────────────────────────────────

/** Maximum documents per Firestore batch write. */
const FIRESTORE_BATCH_LIMIT = 500;

/** Maximum document refs per Firestore `getAll` call. */
const FIRESTORE_GET_ALL_LIMIT = 100;

// ── Time ─────────────────────────────────────────────────────────────────────

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

// ── Document processing ──────────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// ── Document extractors ─────────────────────────────────────────────────────

/** Number of PDF pages per extracted section (larger chunks = fewer AI calls).
 *  At 40 pages/section, a 1000-page PDF produces ~25 sections. */
const PAGES_PER_SECTION = 40;

/** Number of PPTX slides per extracted section (larger chunks = fewer AI calls). */
const SLIDES_PER_SECTION = 30;

/** Number of DOCX words per extracted section (larger chunks = fewer AI calls). */
const WORDS_PER_SECTION = 1800;

/** Minimum characters for a section to be kept (filters empty chunks). */
const MIN_CHARS_PER_SECTION = 100;

/** Maximum characters of section text sent to AI prompts.
 *  ~4K chars ≈ ~1K tokens — aggressive truncation for cost control
 *  on large documents. Blueprint extraction works well even with
 *  partial text since key concepts cluster in early paragraphs. */
const MAX_AI_SECTION_CHARS = 4000;

// ── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Spaced-repetition review configurations keyed by revision policy name.
 * Each entry contains a `dayOffset` (days after the study task) and the
 * review `minutes` allocated for that session.
 */
const REVISION_POLICIES = {
  off: [],
  light: [{ dayOffset: 3, minutes: 10 }],
  standard: [
    { dayOffset: 1, minutes: 10 },
    { dayOffset: 3, minutes: 15 },
    { dayOffset: 7, minutes: 25 },
  ],
  aggressive: [
    { dayOffset: 1, minutes: 15 },
    { dayOffset: 3, minutes: 20 },
    { dayOffset: 7, minutes: 30 },
    { dayOffset: 14, minutes: 20 },
  ],
};

const VALID_REVISION_POLICIES = new Set(Object.keys(REVISION_POLICIES));

/** Default study minutes per day when user provides no value. */
const DEFAULT_MINUTES_PER_DAY = 120;

/** Absolute min/max bounds for daily study minutes. */
const MIN_DAILY_MINUTES = 30;
const MAX_DAILY_MINUTES = 480;

/** Maximum number of calendar days the scheduler will span. */
const MAX_SCHEDULE_DAYS = 365;

/** Default fallback study period when no exam date is set (days). */
const DEFAULT_STUDY_PERIOD_DAYS = 30;

/** Number of future days the catch-up algorithm distributes overdue tasks across. */
const CATCH_UP_SPAN_DAYS = 5;

// ── Triage v2: selective scheduling ─────────────────────────────────────────

/**
 * Composite priority score weights for section triage.
 * Must sum to 1.0.  Derived from retrieval-practice & spacing research:
 * Cepeda et al. 2008, Pavlik & Anderson 2008, Roediger & Butler 2011.
 */
const TRIAGE_WEIGHTS = Object.freeze({
  weakness:       0.30,
  examAlignment:  0.25,
  highYield:      0.15,
  urgency:        0.10,
  questionReady:  0.10,
  difficulty:     0.10,
});

/**
 * Triage band thresholds — sections are classified into three tiers.
 * >= SCHEDULE: placed on the active daily plan.
 * >= BACKLOG:  kept available but not auto-scheduled.
 * <  BACKLOG:  deferred entirely (hidden from the daily plan).
 */
const TRIAGE_SCHEDULE_THRESHOLD = 0.65;
const TRIAGE_BACKLOG_THRESHOLD  = 0.45;

/** Maximum brand-new (first-study) topics placed per day. */
const MAX_NEW_TOPICS_PER_DAY = 3;

/** Maximum total tasks placed per day (new + review + questions). */
const MAX_TASKS_PER_DAY = 8;

/**
 * Mastery suppression: a section is considered mastered when all three
 * conditions are met simultaneously.
 */
const MASTERY_MIN_ACCURACY    = 0.85;
const MASTERY_MAX_DAYS_SINCE  = 7;
const MASTERY_MAX_WEAKNESS    = 0.25;

/**
 * Minimum question coverage (questionsCount) before a QUESTIONS task
 * is considered worthwhile.
 */
const MIN_QUESTIONS_FOR_TASK = 3;

/**
 * Minimum OCR / text content length for a section to be considered
 * non-thin.  Sections shorter than this are candidates for merging.
 */
const THIN_SECTION_MIN_CHARS = 200;

// ── FSRS v5 (adaptive spaced repetition) ────────────────────────────────────

/** Target recall probability for FSRS interval computation. */
const FSRS_DESIRED_RETENTION = 0.9;

/** Minimum review interval in days. */
const FSRS_MIN_INTERVAL = 1;

/** Maximum review interval in days. */
const FSRS_MAX_INTERVAL = 365;

/** Days of recent attempts to consider when grading a section review. */
const FSRS_ATTEMPT_LOOKBACK_DAYS = 7;

// ── Questions ────────────────────────────────────────────────────────────────

/** Difficulty distribution for AI-generated question sets. */
const DIFFICULTY_DISTRIBUTION = { easy: 0.35, medium: null, hard: 0.3 };
// medium is derived: 1 - easy - hard

/** Valid quiz modes. */
const VALID_QUIZ_MODES = new Set(["section", "topic", "mixed", "random"]);

// ── Analytics ────────────────────────────────────────────────────────────────

/** Minimum seconds between consecutive stats re-computations for a course. */
const STATS_THROTTLE_SEC = 30;

/** Number of weakest topics to surface per course. */
const WEAK_TOPICS_LIMIT = 5;

// ── Vision batch processing ──────────────────────────────────────────────────

/** Maximum pages accepted in a single batch extraction call. */
const MAX_BATCH_PAGES = 20;

/** Maximum base64 character length per page image (~250 KB — downsampled for cost). */
const MAX_BASE64_LENGTH = 250_000;

/** Default concurrency for parallel vision requests. */
const DEFAULT_VISION_CONCURRENCY = 4;

/** Hard ceiling on concurrency regardless of caller input. */
const MAX_VISION_CONCURRENCY = 6;

// ── GDPR / data deletion ────────────────────────────────────────────────────

/** Firestore sub-collections under each user document (used for GDPR deletion). */
const USER_SUBCOLLECTIONS = [
  "files",
  "sections",
  "tasks",
  "questions",
  "attempts",
  "stats",
  "jobs",
  "courses",
  "flags",    // Consumer-ready: question flag reports
  "activity", // Consumer-ready: daily activity for streak graph
  "srs",      // FSRS v5: per-section spaced repetition state
];

// ── AI / Anthropic ──────────────────────────────────────────────────────────

/** Default model for all AI calls (Haiku 4.5 for speed + cost). */
const AI_MODEL = "claude-haiku-4-5-20251001";

/** Max tokens for AI responses. */
const AI_MAX_TOKENS = 4096;

/** Number of retry attempts for AI calls. */
const AI_MAX_RETRIES = 2;

/** Base delay in ms for exponential backoff on AI retries. */
const AI_RETRY_BASE_MS = 1000;

/** Default number of questions to auto-generate per section. */
const DEFAULT_QUESTION_COUNT = 6;

/** Hard cap on questions per section. More are only generated on explicit user request. */
const MAX_QUESTIONS_PER_SECTION = 100;

// ── Function timeouts ───────────────────────────────────────────────────────

/** Timeout for file processing (extraction + section creation). */
const TIMEOUT_PROCESS_FILE = 180;

/** Timeout for section AI processing (blueprint + questions). */
const TIMEOUT_PROCESS_SECTION = 120;

/** Timeout for on-demand question generation. */
const TIMEOUT_GENERATE_QUESTIONS = 120;

/** Timeout for lightweight callable functions. */
const TIMEOUT_LIGHT = 60;

/** Timeout for data deletion (may need to delete thousands of docs). */
const TIMEOUT_DELETE_DATA = 300;

// ── Health check ─────────────────────────────────────────────────────────────

const HEALTH_TIMEOUT_MS = 5_000;

// ── Consumer-ready: Lifecycle states ────────────────────────────────────────

/**
 * Ordered ingestion lifecycle for `files/{fileId}.status`.
 * The IngestionStepper component on the frontend reads these values.
 */
const INGESTION_LIFECYCLE = Object.freeze({
  QUEUED:         "queued",
  PARSING:        "parsing",
  CHUNKING:       "chunking",
  INDEXING:       "indexing",
  GENERATING:     "generating_questions",
  READY_PARTIAL:  "ready_partial",
  READY_FULL:     "ready_full",
  FAILED:         "failed",
});

/**
 * Human-readable micro-copy shown in the IngestionStepper for each lifecycle step.
 */
const INGESTION_STEP_LABELS = Object.freeze({
  queued:               "Queued for processing…",
  parsing:              "Reading file…",
  chunking:             "Structuring sections…",
  indexing:             "Indexing content…",
  generating_questions: "Generating initial high-yield questions…",
  ready_partial:        "First questions ready — more loading in the background…",
  ready_full:           "All questions ready!",
  failed:               "Processing failed. Please re-upload.",
});

/** Minimum questions needed before "Quick Review" CTA is unlocked. */
const QUICK_REVIEW_MIN_QUESTIONS = 5;

/** Question quality states stored on each question document. */
const QUESTION_QUALITY = Object.freeze({
  DRAFT:    "draft",
  NORMAL:   "normal",
  VERIFIED: "verified",
});

/** AI confidence score below which a question is auto-labelled DRAFT. */
const QUESTION_CONFIDENCE_THRESHOLD = 0.72;

/** Flag count at which a question is quarantined from quiz serving. */
const FLAG_QUARANTINE_THRESHOLD = 2;

/** Valid reason codes for the flagQuestion callable. */
const FLAG_REASONS = ["incorrect", "ambiguous", "bad_explanation", "source_mismatch", "duplicate", "other"];

/** Days of activity history surfaced in the streak contribution graph (12 weeks). */
const STREAK_HISTORY_DAYS = 84;

// ── Knowledge Cache ─────────────────────────────────────────────────────

/** Maximum cached questions stored per topic+level document. */
const CACHE_MAX_QUESTIONS_PER_TOPIC = 60;

/** Root Firestore collection for the shared knowledge cache. */
const CACHE_COLLECTION = "_knowledgeCache";

module.exports = {
  FIRESTORE_BATCH_LIMIT,
  FIRESTORE_GET_ALL_LIMIT,
  MS_PER_DAY,
  SUPPORTED_MIME_TYPES,
  PAGES_PER_SECTION,
  SLIDES_PER_SECTION,
  WORDS_PER_SECTION,
  MIN_CHARS_PER_SECTION,
  REVISION_POLICIES,
  VALID_REVISION_POLICIES,
  DEFAULT_MINUTES_PER_DAY,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  MAX_SCHEDULE_DAYS,
  DEFAULT_STUDY_PERIOD_DAYS,
  CATCH_UP_SPAN_DAYS,
  FSRS_DESIRED_RETENTION,
  FSRS_MIN_INTERVAL,
  FSRS_MAX_INTERVAL,
  FSRS_ATTEMPT_LOOKBACK_DAYS,
  DIFFICULTY_DISTRIBUTION,
  VALID_QUIZ_MODES,
  STATS_THROTTLE_SEC,
  WEAK_TOPICS_LIMIT,
  MAX_BATCH_PAGES,
  MAX_BASE64_LENGTH,
  DEFAULT_VISION_CONCURRENCY,
  MAX_VISION_CONCURRENCY,
  USER_SUBCOLLECTIONS,
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_MAX_RETRIES,
  AI_RETRY_BASE_MS,
  DEFAULT_QUESTION_COUNT,
  MAX_QUESTIONS_PER_SECTION,
  TIMEOUT_PROCESS_FILE,
  TIMEOUT_PROCESS_SECTION,
  TIMEOUT_GENERATE_QUESTIONS,
  TIMEOUT_LIGHT,
  TIMEOUT_DELETE_DATA,
  HEALTH_TIMEOUT_MS,
  INGESTION_LIFECYCLE,
  INGESTION_STEP_LABELS,
  QUICK_REVIEW_MIN_QUESTIONS,
  QUESTION_QUALITY,
  QUESTION_CONFIDENCE_THRESHOLD,
  FLAG_QUARANTINE_THRESHOLD,
  FLAG_REASONS,
  STREAK_HISTORY_DAYS,
  CACHE_MAX_QUESTIONS_PER_TOPIC,
  CACHE_COLLECTION,
  MAX_AI_SECTION_CHARS,
  TRIAGE_WEIGHTS,
  TRIAGE_SCHEDULE_THRESHOLD,
  TRIAGE_BACKLOG_THRESHOLD,
  MAX_NEW_TOPICS_PER_DAY,
  MAX_TASKS_PER_DAY,
  MASTERY_MIN_ACCURACY,
  MASTERY_MAX_DAYS_SINCE,
  MASTERY_MAX_WEAKNESS,
  MIN_QUESTIONS_FOR_TASK,
  THIN_SECTION_MIN_CHARS,
};
