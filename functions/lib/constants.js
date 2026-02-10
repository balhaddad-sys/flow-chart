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

/** Number of PDF pages per extracted section. */
const PAGES_PER_SECTION = 10;

/** Number of PPTX slides per extracted section. */
const SLIDES_PER_SECTION = 20;

/** Number of DOCX words per extracted section. */
const WORDS_PER_SECTION = 1200;

/** Minimum characters for a section to be kept (filters empty chunks). */
const MIN_CHARS_PER_SECTION = 100;

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

// ── Questions ────────────────────────────────────────────────────────────────

/** Difficulty distribution for AI-generated question sets. */
const DIFFICULTY_DISTRIBUTION = { easy: 0.4, medium: null, hard: 0.2 };
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
const MAX_BATCH_PAGES = 25;

/** Maximum base64 character length per page image (~450 KB). */
const MAX_BASE64_LENGTH = 450_000;

/** Default concurrency for parallel vision requests. */
const DEFAULT_VISION_CONCURRENCY = 8;

/** Hard ceiling on concurrency regardless of caller input. */
const MAX_VISION_CONCURRENCY = 12;

// ── GDPR / data deletion ────────────────────────────────────────────────────

/** Firestore sub-collections under each user document. */
const USER_SUBCOLLECTIONS = [
  "files",
  "sections",
  "tasks",
  "questions",
  "attempts",
  "stats",
  "jobs",
  "courses",
];

// ── Health check ─────────────────────────────────────────────────────────────

const HEALTH_TIMEOUT_MS = 5_000;

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
  DIFFICULTY_DISTRIBUTION,
  VALID_QUIZ_MODES,
  STATS_THROTTLE_SEC,
  WEAK_TOPICS_LIMIT,
  MAX_BATCH_PAGES,
  MAX_BASE64_LENGTH,
  DEFAULT_VISION_CONCURRENCY,
  MAX_VISION_CONCURRENCY,
  USER_SUBCOLLECTIONS,
  HEALTH_TIMEOUT_MS,
};
