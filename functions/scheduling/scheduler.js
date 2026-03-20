/**
 * @module scheduling/scheduler
 * @description Pure scheduling algorithm with optional adaptive planning.
 *
 * Default mode preserves the previous deterministic "spread the workload"
 * behavior. When an adaptive context is supplied, the scheduler still remains
 * fully deterministic, but it starts using learner signals to:
 * - prioritize weak and high-yield topics,
 * - align coverage with the target exam,
 * - interleave nearby topics instead of blindly following section order,
 * - place question tasks after a short retrieval gap when useful,
 * - annotate tasks with focus/rationale metadata so the plan feels specific.
 */

const {
  MS_PER_DAY,
  REVISION_POLICIES,
  VALID_REVISION_POLICIES,
  DEFAULT_MINUTES_PER_DAY,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  MAX_SCHEDULE_DAYS,
  DEFAULT_STUDY_PERIOD_DAYS,
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
} = require("../lib/constants");
const { clampInt, truncate, toISODate, weekdayName } = require("../lib/utils");

const GENERIC_SECTION_TITLE_RE =
  /\b(?:pages?|slides?|section|chapter|part)\s*\d+(?:\s*(?:-|to)\s*\d+)?\b|\b(?:untitled|unknown\s+section)\b/i;
const LEADING_OBJECTIVE_VERB_RE =
  /^(?:understand|describe|explain|identify|recogni[sz]e|differentiate|evaluate|apply|outline|review|summari[sz]e|know)\s+/i;

const EXAM_GROUPS = Object.freeze({
  OSCE: new Set(["OSCE", "PLAB2", "MRCP_PACES"]),
  BASIC_SCIENCE: new Set(["USMLE_STEP1"]),
  CLINICAL_REASONING: new Set(["SBA", "MIXED", "USMLE_STEP2", "PLAB1", "MRCP_PART1", "MRCGP_AKT", "FINALS"]),
});

const EXAM_ALIGNMENT_PATTERNS = Object.freeze({
  OSCE: [
    /\bhistory\b/i,
    /\bexam(?:ination)?\b/i,
    /\bcommunication\b/i,
    /\bcounsel(?:ling)?\b/i,
    /\bconsent\b/i,
    /\bprocedure\b/i,
    /\bsbar\b/i,
    /\bhandover\b/i,
    /\bcapacity\b/i,
    /\bsafeguarding\b/i,
  ],
  BASIC_SCIENCE: [
    /\bpathophysiology\b/i,
    /\bmechanism\b/i,
    /\bbiochem(?:istry)?\b/i,
    /\bpharmac(?:ology|okinetics|odynamics)\b/i,
    /\banatomy\b/i,
    /\bphysiology\b/i,
    /\bimmunology\b/i,
    /\bmicrobiology\b/i,
    /\bgenetic(?:s)?\b/i,
    /\benzyme\b/i,
    /\breceptor\b/i,
  ],
  CLINICAL_REASONING: [
    /\bdiagnos(?:is|tic)\b/i,
    /\bmanagement\b/i,
    /\binvestigation\b/i,
    /\bnext\s+step\b/i,
    /\bcomplication\b/i,
    /\bscreening\b/i,
    /\breferral\b/i,
    /\bemergency\b/i,
    /\btreatment\b/i,
    /\binterpret(?:ation|ing)\b/i,
    /\bhigh[- ]yield\b/i,
  ],
});

function cleanTitleCandidate(value, maxLen = 140) {
  return truncate(String(value || ""), maxLen)
    .replace(/\s+/g, " ")
    .replace(/^[-:;,.()\s]+|[-:;,.()\s]+$/g, "")
    .trim();
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeTopicKey(value) {
  return cleanTitleCandidate(value, 140).toLowerCase();
}

function isGenericSectionTitle(value) {
  const title = cleanTitleCandidate(value, 220);
  if (!title) return true;
  if (GENERIC_SECTION_TITLE_RE.test(title)) return true;
  if (/^(?:section|topic|part)\s*[a-z0-9]+$/i.test(title)) return true;
  return false;
}

function objectiveToTopic(value) {
  return cleanTitleCandidate(value, 140)
    .replace(LEADING_OBJECTIVE_VERB_RE, "")
    .replace(/^the\s+/i, "")
    .replace(/[.?!].*$/, "")
    .trim();
}

function pushCandidate(candidates, seen, value) {
  const candidate = objectiveToTopic(value);
  if (!candidate || isGenericSectionTitle(candidate)) return;

  const key = candidate.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  candidates.push(candidate);
}

function pickSpecificFromSources(...sources) {
  for (const source of sources) {
    const values = Array.isArray(source) ? source : [source];
    for (const value of values) {
      const candidate = objectiveToTopic(value);
      if (candidate && !isGenericSectionTitle(candidate)) {
        return truncate(candidate, 180);
      }
    }
  }
  return "";
}

function deriveSectionTaskTitle(section, sourceOrder = 0) {
  const rawTitle = cleanTitleCandidate(section.title, 200);
  if (rawTitle && !isGenericSectionTitle(rawTitle)) {
    return rawTitle;
  }

  const candidates = [];
  const seen = new Set();
  const topicTags = Array.isArray(section.topicTags) ? section.topicTags : [];
  const blueprint = section.blueprint || {};
  const keyConcepts = Array.isArray(blueprint.keyConcepts) ? blueprint.keyConcepts : [];
  const learningObjectives = Array.isArray(blueprint.learningObjectives) ? blueprint.learningObjectives : [];
  const highYieldPoints = Array.isArray(blueprint.highYieldPoints) ? blueprint.highYieldPoints : [];
  const termsToDefine = Array.isArray(blueprint.termsToDefine) ? blueprint.termsToDefine : [];

  for (const tag of topicTags.slice(0, 5)) pushCandidate(candidates, seen, tag);
  for (const concept of keyConcepts.slice(0, 4)) pushCandidate(candidates, seen, concept);
  for (const term of termsToDefine.slice(0, 4)) pushCandidate(candidates, seen, term);
  for (const objective of learningObjectives.slice(0, 3)) pushCandidate(candidates, seen, objective);
  for (const point of highYieldPoints.slice(0, 2)) pushCandidate(candidates, seen, point);

  if (candidates.length > 0) {
    const primary = candidates[0];
    const secondary = candidates.find((value) => value.toLowerCase() !== primary.toLowerCase());
    return truncate(secondary ? `${primary} - ${secondary}` : primary, 200);
  }

  if (rawTitle) return rawTitle;
  return `Section ${sourceOrder + 1}`;
}

function normalizeExamTypeKey(examType) {
  const key = String(examType || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  if (!key) return "GENERAL";
  if (EXAM_GROUPS.OSCE.has(key)) return "OSCE";
  if (EXAM_GROUPS.BASIC_SCIENCE.has(key)) return "BASIC_SCIENCE";
  if (EXAM_GROUPS.CLINICAL_REASONING.has(key)) return "CLINICAL_REASONING";
  return key;
}

/**
 * Apply a confidence adjustment to weakness scores based on the number of
 * quiz attempts. With very few attempts (< 5), the weakness score is
 * regressed toward a neutral 0.35 to avoid over-reacting to small samples.
 *
 * At 5+ attempts the score is used at full weight. This prevents a single
 * wrong answer from making a topic appear critically weak.
 */
function confidenceAdjust(rawWeakness, attemptCount) {
  if (attemptCount == null || attemptCount >= 5) return rawWeakness;
  if (attemptCount <= 0) return 0.35; // no data, use neutral
  const NEUTRAL = 0.35;
  const confidence = Math.min(1, attemptCount / 5);
  return NEUTRAL + (rawWeakness - NEUTRAL) * confidence;
}

function buildWeaknessMap(weakestTopics = [], allTopicScores = []) {
  const weaknessByTag = new Map();

  // Prefer full topic profile when available (not capped to top-5)
  const source = Array.isArray(allTopicScores) && allTopicScores.length > 0
    ? allTopicScores
    : (Array.isArray(weakestTopics) ? weakestTopics : []);

  for (const topic of source) {
    const key = normalizeTopicKey(topic?.tag);
    if (!key) continue;
    const raw = clamp01(Number(topic?.weaknessScore ?? 0));
    const adjusted = confidenceAdjust(raw, topic?.attemptCount);
    weaknessByTag.set(key, adjusted);
  }

  return weaknessByTag;
}

function buildAdaptiveContext({
  startDate = new Date(),
  examDate = null,
  examType = null,
  stats = null,
  taskBehavior = null,
} = {}) {
  const safeStart = startDate instanceof Date ? startDate : new Date(startDate || Date.now());
  const safeExam = examDate instanceof Date ? examDate : (examDate ? new Date(examDate) : null);
  const daysToExam = safeExam
    ? Math.max(0, Math.ceil((safeExam.getTime() - safeStart.getTime()) / MS_PER_DAY))
    : null;

  // Build last-review recency map from stats
  const lastReviewByTag = new Map();
  if (stats?.lastReviewByTag) {
    for (const [tag, timestamp] of Object.entries(stats.lastReviewByTag)) {
      const date = timestamp?.toDate?.() ?? (typeof timestamp === "number" ? new Date(timestamp) : null);
      if (date) {
        const daysSince = Math.max(0, Math.ceil((safeStart.getTime() - date.getTime()) / MS_PER_DAY));
        lastReviewByTag.set(normalizeTopicKey(tag), daysSince);
      }
    }
  }

  // Build per-section behavior map from prior task data (skipped, overtimed, etc.)
  const sectionBehavior = new Map();
  if (taskBehavior && Array.isArray(taskBehavior)) {
    for (const task of taskBehavior) {
      for (const sectionId of (task.sectionIds || [])) {
        if (!sectionBehavior.has(sectionId)) {
          sectionBehavior.set(sectionId, { skippedCount: 0, overtimeRatio: 0, totalAttempts: 0 });
        }
        const entry = sectionBehavior.get(sectionId);
        entry.totalAttempts++;
        if (task.status === "SKIPPED") entry.skippedCount++;
        if (task.status === "DONE" && task.actualMinutes && task.estMinutes) {
          entry.overtimeRatio = Math.max(entry.overtimeRatio, task.actualMinutes / task.estMinutes);
        }
      }
    }
  }

  return {
    enabled: true,
    startDate: safeStart,
    examDate: safeExam,
    daysToExam,
    examTypeKey: normalizeExamTypeKey(examType),
    overallAccuracy: clamp01(Number(stats?.overallAccuracy ?? 0)),
    completionPercent: clamp01(Number(stats?.completionPercent ?? 0)),
    weaknessByTag: buildWeaknessMap(stats?.weakestTopics, stats?.allTopicScores),
    lastReviewByTag,
    sectionBehavior,
  };
}

function collectSectionText(section) {
  const blueprint = section.blueprint || {};
  return [
    section.title,
    ...(Array.isArray(section.topicTags) ? section.topicTags : []),
    ...(Array.isArray(blueprint.learningObjectives) ? blueprint.learningObjectives : []),
    ...(Array.isArray(blueprint.keyConcepts) ? blueprint.keyConcepts : []),
    ...(Array.isArray(blueprint.highYieldPoints) ? blueprint.highYieldPoints : []),
    ...(Array.isArray(blueprint.commonTraps) ? blueprint.commonTraps : []),
    ...(Array.isArray(blueprint.termsToDefine) ? blueprint.termsToDefine : []),
  ]
    .filter(Boolean)
    .join(" ");
}

function computeExamAlignment(section, adaptiveContext) {
  if (!adaptiveContext) return 0.5;

  const key = adaptiveContext.examTypeKey;
  const sectionText = collectSectionText(section);
  if (!sectionText) return 0.35;

  let patterns = null;
  if (key === "OSCE") patterns = EXAM_ALIGNMENT_PATTERNS.OSCE;
  else if (key === "BASIC_SCIENCE") patterns = EXAM_ALIGNMENT_PATTERNS.BASIC_SCIENCE;
  else if (key === "CLINICAL_REASONING") patterns = EXAM_ALIGNMENT_PATTERNS.CLINICAL_REASONING;

  if (!patterns || patterns.length === 0) return 0.5;

  let hits = 0;
  for (const pattern of patterns) {
    if (pattern.test(sectionText)) hits++;
  }

  // Blueprint density bonus: sections with rich structured content
  // are inherently more exam-assessable
  const bp = section.blueprint || {};
  const bpItems = (bp.highYieldPoints?.length || 0) + (bp.commonTraps?.length || 0);
  const bpBonus = bpItems >= 4 ? 0.12 : bpItems >= 2 ? 0.06 : 0;

  return clamp01(0.30 + hits * 0.12 + bpBonus);
}

function computeHighYieldDensity(section) {
  const blueprint = section.blueprint || {};
  const highYieldCount = Array.isArray(blueprint.highYieldPoints) ? blueprint.highYieldPoints.length : 0;
  const commonTrapCount = Array.isArray(blueprint.commonTraps) ? blueprint.commonTraps.length : 0;
  const keyConceptCount = Array.isArray(blueprint.keyConcepts) ? blueprint.keyConcepts.length : 0;
  return clamp01((highYieldCount + commonTrapCount * 1.25 + Math.min(3, keyConceptCount) * 0.35) / 6);
}

/**
 * Apply recency decay to a weakness score based on how many days ago the topic
 * was last reviewed. Recent reviews keep the score near its raw value; stale
 * scores decay toward a neutral 0.35 baseline so that un-reviewed topics
 * gradually regain priority without losing the weakness signal entirely.
 *
 * Half-life of 14 days: after 14 days without review the score moves ~50%
 * toward the neutral baseline. This is a lightweight exponential decay that
 * adds no measurable cost (one Math.exp per tag lookup).
 */
function applyRecencyDecay(rawWeakness, daysSinceReview) {
  if (daysSinceReview == null || daysSinceReview <= 0) return rawWeakness;
  const NEUTRAL = 0.35;
  const HALF_LIFE = 14;
  const decay = Math.exp(-0.693 * daysSinceReview / HALF_LIFE); // ln(2) ≈ 0.693
  return NEUTRAL + (rawWeakness - NEUTRAL) * decay;
}

function lookupSectionWeakness(section, adaptiveContext) {
  if (!adaptiveContext) return 0;

  const topicTags = Array.isArray(section.topicTags) ? section.topicTags : [];
  let strongest = 0;

  for (const tag of topicTags) {
    const key = normalizeTopicKey(tag);
    let weakness = adaptiveContext.weaknessByTag.get(key) || 0;
    // Apply recency decay when review history is available
    if (weakness > 0 && adaptiveContext.lastReviewByTag && adaptiveContext.lastReviewByTag.size > 0) {
      const daysSince = adaptiveContext.lastReviewByTag.get(key);
      if (daysSince != null) {
        weakness = applyRecencyDecay(weakness, daysSince);
      }
    }
    strongest = Math.max(strongest, weakness);
  }

  const titleKey = normalizeTopicKey(section.title);
  let titleWeakness = adaptiveContext.weaknessByTag.get(titleKey) || 0;
  if (titleWeakness > 0 && adaptiveContext.lastReviewByTag && adaptiveContext.lastReviewByTag.size > 0) {
    const daysSince = adaptiveContext.lastReviewByTag.get(titleKey);
    if (daysSince != null) {
      titleWeakness = applyRecencyDecay(titleWeakness, daysSince);
    }
  }
  strongest = Math.max(strongest, titleWeakness);

  if (strongest > 0) return strongest;

  // No topic-level data — use a graduated fallback based on overall accuracy.
  // This only fires for sections whose tags weren't covered in any quiz attempt.
  if (adaptiveContext.overallAccuracy <= 0) return 0.3; // no data yet
  if (adaptiveContext.overallAccuracy < 0.55) return 0.40;
  if (adaptiveContext.overallAccuracy < 0.65) return 0.30;
  if (adaptiveContext.overallAccuracy < 0.80) return 0.15;
  return 0;
}

function selectPrimaryTopicTag(section, adaptiveContext, fallbackTitle) {
  const topicTags = Array.isArray(section.topicTags) ? section.topicTags : [];
  if (topicTags.length === 0) {
    return cleanTitleCandidate(fallbackTitle || section.title, 120);
  }

  if (!adaptiveContext) return cleanTitleCandidate(topicTags[0], 120);

  const sorted = [...topicTags].sort((a, b) => {
    const weaknessA = adaptiveContext.weaknessByTag.get(normalizeTopicKey(a)) || 0;
    const weaknessB = adaptiveContext.weaknessByTag.get(normalizeTopicKey(b)) || 0;
    if (weaknessA !== weaknessB) return weaknessB - weaknessA;
    return String(a).localeCompare(String(b));
  });

  return cleanTitleCandidate(sorted[0], 120);
}

function computeSectionAdaptiveSignals(section, adaptiveContext, fallbackTitle) {
  const difficulty = clampInt(section.difficulty || 3, 1, 5);
  const weakness = lookupSectionWeakness(section, adaptiveContext);
  const highYieldDensity = computeHighYieldDensity(section);
  const examAlignment = computeExamAlignment(section, adaptiveContext);
  const urgency = adaptiveContext?.daysToExam == null
    ? 0.45
    : clamp01(1 - Math.min(120, adaptiveContext.daysToExam) / 120);
  const difficultyScore = clamp01((difficulty - 1) / 4);

  const score = clamp01(
    weakness * 0.33
    + highYieldDensity * 0.23
    + examAlignment * 0.16
    + difficultyScore * 0.14
    + urgency * 0.14
  );

  const questionGapDays = adaptiveContext?.daysToExam != null && adaptiveContext.daysToExam <= 5
    ? 0
    : (weakness >= 0.55 || difficulty >= 4 || highYieldDensity >= 0.55 ? 1 : 0);

  return {
    weakness,
    highYieldDensity,
    examAlignment,
    urgency,
    score,
    priority: clampInt(Math.round(score * 100), 0, 100),
    questionGapDays,
    primaryTopicTag: selectPrimaryTopicTag(section, adaptiveContext, fallbackTitle),
  };
}

// ── Triage v2: selective scheduling ────────────────────────────────────────

/**
 * Compute the v2 composite triage score using the research-backed weight mix.
 * Returns a 0-1 score and a tier classification.
 */
function computeTriageScore(section, adaptiveContext) {
  if (!adaptiveContext) return { triageScore: 0.5, triageTier: "schedule", exclusionReason: null };

  const difficulty = clampInt(section.difficulty || 3, 1, 5);
  const weakness = lookupSectionWeakness(section, adaptiveContext);
  const examAlignment = computeExamAlignment(section, adaptiveContext);
  const highYieldDensity = computeHighYieldDensity(section);
  const urgency = adaptiveContext.daysToExam == null
    ? 0.45
    : clamp01(1 - Math.min(120, adaptiveContext.daysToExam) / 120);
  const questionReady = section.questionsStatus === "COMPLETED"
    ? clamp01(Math.min(1, (section.questionsCount || 0) / 10))
    : 0;
  const difficultyScore = clamp01((difficulty - 1) / 4);

  const triageScore = clamp01(
    weakness         * TRIAGE_WEIGHTS.weakness
    + examAlignment  * TRIAGE_WEIGHTS.examAlignment
    + highYieldDensity * TRIAGE_WEIGHTS.highYield
    + urgency        * TRIAGE_WEIGHTS.urgency
    + questionReady  * TRIAGE_WEIGHTS.questionReady
    + difficultyScore * TRIAGE_WEIGHTS.difficulty
  );

  let triageTier;
  let exclusionReason = null;

  if (triageScore >= TRIAGE_SCHEDULE_THRESHOLD) {
    triageTier = "schedule";
  } else if (triageScore >= TRIAGE_BACKLOG_THRESHOLD) {
    triageTier = "backlog";
    exclusionReason = buildExclusionReason("backlog", { weakness, examAlignment, highYieldDensity, urgency });
  } else {
    triageTier = "defer";
    exclusionReason = buildExclusionReason("defer", { weakness, examAlignment, highYieldDensity, urgency });
  }

  return { triageScore, triageTier, exclusionReason, weakness, examAlignment, highYieldDensity, urgency, questionReady, difficultyScore };
}

/**
 * Check whether a section is mastered: strong recent accuracy, recent review,
 * and no current weakness signal.
 */
function isMastered(section, adaptiveContext) {
  if (!adaptiveContext) return false;

  const weakness = lookupSectionWeakness(section, adaptiveContext);
  if (weakness > MASTERY_MAX_WEAKNESS) return false;
  if (adaptiveContext.overallAccuracy < MASTERY_MIN_ACCURACY) return false;

  // Check recency: mastery requires a recent review within MASTERY_MAX_DAYS_SINCE
  const topicTags = Array.isArray(section.topicTags) ? section.topicTags : [];
  let hasRecentReview = false;

  if (adaptiveContext.lastReviewByTag && adaptiveContext.lastReviewByTag.size > 0) {
    for (const tag of topicTags) {
      const daysSince = adaptiveContext.lastReviewByTag.get(normalizeTopicKey(tag));
      if (daysSince != null && daysSince <= MASTERY_MAX_DAYS_SINCE) {
        hasRecentReview = true;
        break;
      }
    }
    // If we have review data but no recent review, topic isn't truly mastered
    if (!hasRecentReview) return false;
  }
  // If no review data at all, fall through to weakness-only check (backward compat)

  for (const tag of topicTags) {
    const tagWeakness = adaptiveContext.weaknessByTag.get(normalizeTopicKey(tag));
    if (tagWeakness != null && tagWeakness <= MASTERY_MAX_WEAKNESS) return true;
  }

  return weakness <= MASTERY_MAX_WEAKNESS && adaptiveContext.overallAccuracy >= MASTERY_MIN_ACCURACY;
}

/**
 * Determine if a section has enough question coverage and retrieval value
 * to warrant a QUESTIONS task.
 */
function hasRetrievalValue(section, adaptiveContext) {
  if (section.questionsStatus !== "COMPLETED") return false;
  if ((section.questionsCount || 0) < MIN_QUESTIONS_FOR_TASK) return false;
  if (!adaptiveContext) return true;

  const weakness = lookupSectionWeakness(section, adaptiveContext);
  const examAlignment = computeExamAlignment(section, adaptiveContext);
  const highYieldDensity = computeHighYieldDensity(section);

  return weakness >= 0.40 || examAlignment >= 0.60 || highYieldDensity >= 0.45;
}

/**
 * Check if a section is "thin" — too little content to be a standalone task.
 */
function isThinSection(section) {
  const textLen = section.textLength || section.charCount || 0;
  if (textLen > 0 && textLen < THIN_SECTION_MIN_CHARS) return true;

  const bp = section.blueprint || {};
  const totalItems = (bp.learningObjectives?.length || 0)
    + (bp.keyConcepts?.length || 0)
    + (bp.highYieldPoints?.length || 0)
    + (bp.commonTraps?.length || 0);
  return totalItems === 0 && isGenericSectionTitle(section.title);
}

/**
 * Merge adjacent thin/low-priority sections into combined study blocks.
 */
function mergeAdjacentThinSections(sections, triageResults) {
  if (sections.length <= 1) return sections;

  const merged = [];
  let pendingGroup = null;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const triage = triageResults.get(section.id);
    const thin = isThinSection(section);
    const lowPriority = triage && triage.triageTier !== "schedule";

    if (thin || (lowPriority && (section.estMinutes || 15) <= 10)) {
      if (!pendingGroup) {
        pendingGroup = { sections: [section], ids: [section.id], topicTags: new Set(section.topicTags || []), totalMinutes: section.estMinutes || 15 };
      } else {
        pendingGroup.sections.push(section);
        pendingGroup.ids.push(section.id);
        for (const tag of (section.topicTags || [])) pendingGroup.topicTags.add(tag);
        pendingGroup.totalMinutes += section.estMinutes || 15;
      }
    } else {
      if (pendingGroup) { merged.push(finalizeMergedGroup(pendingGroup)); pendingGroup = null; }
      merged.push(section);
    }
  }

  if (pendingGroup) merged.push(finalizeMergedGroup(pendingGroup));
  return merged;
}

function finalizeMergedGroup(group) {
  if (group.sections.length === 1) return group.sections[0];
  const primary = group.sections[0];
  const allTags = [...group.topicTags].slice(0, 10);
  const title = allTags.length > 0
    ? allTags.slice(0, 3).join(", ")
    : `Combined: ${group.sections.map((s) => s.title).slice(0, 2).join(" + ")}`;

  return {
    ...primary,
    id: group.ids[0],
    _mergedSectionIds: group.ids,
    title,
    topicTags: allTags,
    estMinutes: Math.min(group.totalMinutes, 45),
    _isMerged: true,
  };
}

function buildExclusionReason(tier, signals) {
  if (tier === "defer") {
    if (signals.weakness < 0.2 && signals.examAlignment < 0.4) return "Deferred: low exam relevance and no weakness signal";
    if (signals.weakness < 0.2) return "Deferred: recently mastered";
    if (signals.examAlignment < 0.4) return "Deferred: low exam relevance";
    return "Deferred: low overall priority";
  }
  if (tier === "backlog") {
    if (signals.weakness < 0.3) return "Backlogged: no significant weakness";
    if (signals.examAlignment < 0.5) return "Backlogged: low exam alignment";
    if (signals.highYieldDensity < 0.3) return "Backlogged: low high-yield density";
    return "Backlogged: moderate priority — will schedule if capacity allows";
  }
  return null;
}

/**
 * Run triage on all sections. Returns partitioned sections + per-section results.
 */
function triageSections(sections, adaptiveContext) {
  const results = new Map();
  const scheduled = [];
  const backlog = [];
  const deferred = [];

  for (const section of sections) {
    const triage = computeTriageScore(section, adaptiveContext);
    const mastered = isMastered(section, adaptiveContext);

    if (mastered && triage.triageTier === "schedule") {
      triage.triageTier = "backlog";
      triage.exclusionReason = "Backlogged: recently mastered with strong accuracy";
    }

    results.set(section.id, triage);

    if (triage.triageTier === "schedule") scheduled.push(section);
    else if (triage.triageTier === "backlog") backlog.push(section);
    else deferred.push(section);
  }

  return { results, scheduled, backlog, deferred };
}

function buildStudyFocus(section, fallbackTitle) {
  const blueprint = section.blueprint || {};
  const primary = pickSpecificFromSources(
    blueprint.learningObjectives,
    blueprint.keyConcepts,
    blueprint.termsToDefine,
    section.topicTags,
    fallbackTitle
  );
  const trap = pickSpecificFromSources(blueprint.commonTraps, blueprint.highYieldPoints);

  if (primary && trap && normalizeTopicKey(primary) !== normalizeTopicKey(trap)) {
    return truncate(`${primary}; watch for ${trap}`, 220);
  }

  return primary || truncate(fallbackTitle, 220);
}

function buildQuestionFocus(section, fallbackTitle) {
  const blueprint = section.blueprint || {};
  const primary = pickSpecificFromSources(
    blueprint.highYieldPoints,
    blueprint.commonTraps,
    blueprint.keyConcepts,
    section.topicTags,
    fallbackTitle
  );
  const secondary = pickSpecificFromSources(blueprint.commonTraps, blueprint.learningObjectives);

  if (primary && secondary && normalizeTopicKey(primary) !== normalizeTopicKey(secondary)) {
    return truncate(`${primary}; avoid ${secondary}`, 220);
  }

  return primary || truncate(fallbackTitle, 220);
}

function buildReviewFocus(section, fallbackTitle) {
  const blueprint = section.blueprint || {};
  const primary = pickSpecificFromSources(
    section.topicTags,
    blueprint.keyConcepts,
    blueprint.learningObjectives,
    fallbackTitle
  );
  const secondary = pickSpecificFromSources(blueprint.commonTraps, blueprint.highYieldPoints);

  if (primary && secondary && normalizeTopicKey(primary) !== normalizeTopicKey(secondary)) {
    return truncate(`${primary}; revisit ${secondary}`, 220);
  }

  return primary || truncate(fallbackTitle, 220);
}

function buildTaskFocus(type, section, fallbackTitle) {
  if (type === "QUESTIONS") return buildQuestionFocus(section, fallbackTitle);
  if (type === "REVIEW") return buildReviewFocus(section, fallbackTitle);
  return buildStudyFocus(section, fallbackTitle);
}

function buildTaskRationale(type, signals, adaptiveContext, planPosition = null) {
  const reasons = [];
  const topicName = signals.primaryTopicTag ? truncate(signals.primaryTopicTag, 40) : null;

  // Weakness — graduated phrasing
  if (signals.weakness >= 0.80) {
    reasons.push(topicName ? `critical gap in ${topicName}` : "critical weakness detected");
  } else if (signals.weakness >= 0.65) {
    reasons.push(topicName ? `${topicName} needs focused review` : "weak topic — prioritized");
  } else if (signals.weakness >= 0.45) {
    reasons.push(topicName ? `reinforcing ${topicName}` : "moderate weakness — reinforcement scheduled");
  }

  // High-yield density
  if (signals.highYieldDensity >= 0.7) reasons.push("dense in high-yield facts and common traps");
  else if (signals.highYieldDensity >= 0.55) reasons.push("high-yield content");

  // Exam alignment
  if (signals.examAlignment >= 0.7 && adaptiveContext?.examTypeKey !== "GENERAL") {
    const examLabel = adaptiveContext.examTypeKey === "OSCE" ? "OSCE stations"
      : adaptiveContext.examTypeKey === "BASIC_SCIENCE" ? "basic science exam"
      : "clinical reasoning exam";
    reasons.push(`aligned with ${examLabel}`);
  } else if (signals.examAlignment >= 0.55 && adaptiveContext?.examTypeKey !== "GENERAL") {
    reasons.push("moderate exam relevance");
  }

  // Urgency
  if (adaptiveContext?.daysToExam != null) {
    if (adaptiveContext.daysToExam <= 3) reasons.push("exam imminent");
    else if (adaptiveContext.daysToExam <= 7) reasons.push("exam this week");
    else if (adaptiveContext.daysToExam <= 14) reasons.push("exam within 2 weeks");
  }

  // Plan position context — helps the learner understand why a task is
  // placed early or late in the plan without adding any algorithmic cost
  if (planPosition != null) {
    if (planPosition <= 0.15) reasons.push("front-loaded for early foundation");
    else if (planPosition >= 0.85) reasons.push("consolidation phase");
  }

  // Type-specific detail
  if (type === "QUESTIONS") {
    if (signals.questionGapDays > 0) reasons.push("delayed retrieval practice for deeper encoding");
    else reasons.push("immediate recall check");
  } else if (type === "REVIEW") {
    if (signals.weakness >= 0.55) reasons.push("spaced repetition — targeting weak area");
    else reasons.push("spaced reinforcement");
  }

  if (reasons.length === 0) reasons.push("scheduled for curriculum coverage");
  return truncate(reasons.slice(0, 3).join(", "), 220);
}

function condenseFocusForTitle(focus) {
  return cleanTitleCandidate(String(focus || "").split(/[.;]/)[0], 110);
}

function buildTaskTitle(prefix, baseTitle, focus) {
  const cleanBase = cleanTitleCandidate(baseTitle, 170) || "Section";
  const shortFocus = condenseFocusForTitle(focus);

  if (!shortFocus) return `${prefix}: ${cleanBase}`;
  if (cleanBase.toLowerCase().includes(shortFocus.toLowerCase())) {
    return `${prefix}: ${cleanBase}`;
  }

  return truncate(`${prefix}: ${cleanBase} - ${shortFocus}`, 200);
}

function adaptiveTaskPriority(type, signals) {
  const base = signals.priority;
  if (type === "QUESTIONS") {
    return clampInt(base + (signals.weakness >= 0.55 ? 10 : 6), 0, 100);
  }
  if (type === "REVIEW") {
    return clampInt(base + 4, 0, 100);
  }
  return base;
}

/**
 * @typedef {Object} SectionInput
 * @property {string}   id
 * @property {string}   title
 * @property {number}   [estMinutes=15]
 * @property {number}   [difficulty=3]
 * @property {string[]} [topicTags=[]]
 * @property {string}   [questionsStatus] - "PENDING"|"GENERATING"|"COMPLETED"|"FAILED"
 */

/**
 * @typedef {Object} AvailabilityConfig
 * @property {number}  [defaultMinutesPerDay=120]
 * @property {Object<string,number>} [perDayOverrides]
 * @property {string[]} [excludedDates]
 * @property {number}  [catchUpBufferPercent=15]
 */

/**
 * @typedef {Object} WorkUnit
 * @property {string}   courseId
 * @property {"STUDY"|"QUESTIONS"|"REVIEW"} type
 * @property {string}   title
 * @property {string[]} sectionIds
 * @property {string[]} topicTags
 * @property {number}   estMinutes
 * @property {number}   difficulty
 * @property {string}   status
 * @property {boolean}  isPinned
 * @property {number}   priority
 * @property {number}   [sourceOrder]
 * @property {number}   [_dayOffset]
 */

/**
 * @typedef {Object} DaySlot
 * @property {Date}   date
 * @property {number} usableCapacity
 * @property {number} remaining
 */

/**
 * @typedef {Object} PlacedTask
 * @property {Date}   dueDate
 * @property {number} orderIndex
 */

/**
 * Convert a list of sections into STUDY, QUESTIONS, and REVIEW work units.
 *
 * When `srsCards` is provided and contains an entry for a section with a valid
 * `nextReview` date, a single FSRS-driven REVIEW task is created using the
 * adaptive interval instead of the static policy offsets. Sections without
 * SRS cards fall back to the static `REVISION_POLICIES`.
 *
 * @param {SectionInput[]} sections
 * @param {string} courseId
 * @param {string} [revisionPolicy="standard"]
 * @param {Map<string,Object>|Object<string,Object>} [srsCards]
 * @param {object|null} [adaptiveContext=null]
 * @returns {WorkUnit[]}
 */
function buildWorkUnits(sections, courseId, revisionPolicy = "standard", srsCards, adaptiveContext = null) {
  const policy = VALID_REVISION_POLICIES.has(revisionPolicy) ? revisionPolicy : "standard";
  const tasks = [];
  const srsMap = srsCards instanceof Map ? srsCards : (srsCards ? new Map(Object.entries(srsCards)) : null);
  const reviewsEnabled = policy !== "off";

  for (const [sourceOrder, section] of sections.entries()) {
    let estMinutes = clampInt(section.estMinutes || 15, 5, 240);
    const difficulty = clampInt(section.difficulty || 3, 1, 5);

    // Rescale based on prior behavior: overtime sections get more time,
    // repeatedly-skipped sections get smaller focused blocks
    if (adaptiveContext?.sectionBehavior) {
      const behavior = adaptiveContext.sectionBehavior.get(section.id);
      if (behavior) {
        if (behavior.skippedCount >= 2) {
          // Repeatedly skipped — make it smaller and more focused
          estMinutes = clampInt(Math.round(estMinutes * 0.6), 5, 240);
        } else if (behavior.overtimeRatio > 1.5) {
          // Takes much longer than estimated — give more time
          estMinutes = clampInt(Math.round(estMinutes * Math.min(1.4, behavior.overtimeRatio)), 5, 240);
        }
      }
    }

    const baseTitle = deriveSectionTaskTitle(section, sourceOrder);
    const topicTags = (section.topicTags || []).slice(0, 10);
    const adaptiveSignals = adaptiveContext ? computeSectionAdaptiveSignals(section, adaptiveContext, baseTitle) : null;
    const sharedAdaptive = adaptiveSignals
      ? {
          topicTag: adaptiveSignals.primaryTopicTag,
          adaptiveScore: Number(adaptiveSignals.score.toFixed(3)),
          isAdaptive: true,
        }
      : {};

    // For merged sections, use all constituent IDs; otherwise just the one
    const allSectionIds = section._mergedSectionIds || [section.id];

    const base = {
      courseId,
      sectionIds: allSectionIds,
      topicTags,
      difficulty,
      status: "TODO",
      isPinned: false,
      priority: 0,
      sourceOrder,
    };

    // Plan position: 0.0 = first section, 1.0 = last section
    const planPosition = sections.length > 1 ? sourceOrder / (sections.length - 1) : 0.5;

    const studyFocus = adaptiveSignals ? buildTaskFocus("STUDY", section, baseTitle) : "";
    tasks.push({
      ...base,
      ...sharedAdaptive,
      type: "STUDY",
      title: adaptiveSignals ? buildTaskTitle("Study", baseTitle, studyFocus) : `Study: ${baseTitle}`,
      estMinutes,
      ...(adaptiveSignals ? {
        focus: studyFocus,
        rationale: buildTaskRationale("STUDY", adaptiveSignals, adaptiveContext, planPosition),
        priority: adaptiveTaskPriority("STUDY", adaptiveSignals),
      } : {}),
    });

    // Gate: only create question tasks when retrieval value is present (adaptive)
    // or questions are completed (non-adaptive fallback)
    const shouldCreateQuestions = adaptiveContext
      ? hasRetrievalValue(section, adaptiveContext)
      : section.questionsStatus === "COMPLETED";

    if (shouldCreateQuestions) {
      const questionFocus = adaptiveSignals ? buildTaskFocus("QUESTIONS", section, baseTitle) : "";
      tasks.push({
        ...base,
        ...sharedAdaptive,
        type: "QUESTIONS",
        title: adaptiveSignals ? buildTaskTitle("Questions", baseTitle, questionFocus) : `Questions: ${baseTitle}`,
        estMinutes: Math.min(estMinutes, Math.max(8, Math.round(estMinutes * 0.35))),
        ...(adaptiveSignals ? {
          focus: questionFocus,
          rationale: buildTaskRationale("QUESTIONS", adaptiveSignals, adaptiveContext, planPosition),
          priority: adaptiveTaskPriority("QUESTIONS", adaptiveSignals),
          _dayOffset: adaptiveSignals.questionGapDays,
        } : {}),
      });
    }

    const reviewFocus = adaptiveSignals ? buildTaskFocus("REVIEW", section, baseTitle) : "";
    const reviewMeta = adaptiveSignals
      ? {
          ...sharedAdaptive,
          focus: reviewFocus,
          rationale: buildTaskRationale("REVIEW", adaptiveSignals, adaptiveContext, planPosition),
          priority: adaptiveTaskPriority("REVIEW", adaptiveSignals),
        }
      : {};

    const srsCard = reviewsEnabled ? srsMap?.get(section.id) : null;
    if (srsCard && srsCard.nextReview && srsCard.interval > 0) {
      const reviewMinutes = Math.max(10, Math.min(30, Math.round(10 + (srsCard.difficulty / 10) * 20)));
      tasks.push({
        ...base,
        ...reviewMeta,
        type: "REVIEW",
        title: adaptiveSignals ? buildTaskTitle("Review", baseTitle, reviewFocus) : `Review: ${baseTitle}`,
        estMinutes: reviewMinutes,
        _dayOffset: srsCard.interval,
        fsrsGenerated: true,
      });
    } else {
      for (const review of REVISION_POLICIES[policy]) {
        tasks.push({
          ...base,
          ...reviewMeta,
          type: "REVIEW",
          title: adaptiveSignals ? buildTaskTitle("Review", baseTitle, reviewFocus) : `Review: ${baseTitle}`,
          estMinutes: review.minutes,
          _dayOffset: review.dayOffset,
        });
      }
    }
  }

  return tasks;
}

function computeTotalLoad(tasks) {
  return tasks.reduce((sum, t) => sum + t.estMinutes, 0);
}

function buildDayCapacities(today, examDate, availability = {}) {
  const endDate = examDate || new Date(today.getTime() + DEFAULT_STUDY_PERIOD_DAYS * MS_PER_DAY);
  const defaultMinutes = clampInt(availability.defaultMinutesPerDay ?? DEFAULT_MINUTES_PER_DAY, MIN_DAILY_MINUTES, MAX_DAILY_MINUTES);
  const excludedDates = new Set((availability.excludedDates || []).slice(0, 365));
  const catchUpBuffer = clampInt(availability.catchUpBufferPercent ?? 15, 0, 50) / 100;

  const days = [];
  let cursor = new Date(today);
  let dayCount = 0;

  while (cursor <= endDate && dayCount < MAX_SCHEDULE_DAYS) {
    const iso = toISODate(cursor);
    const dayName = weekdayName(cursor);

    if (!excludedDates.has(iso)) {
      const override = (availability.perDayOverrides ?? availability.perDay)?.[dayName];
      const capacity = override != null ? clampInt(override, 0, MAX_DAILY_MINUTES) : defaultMinutes;
      const usable = Math.floor(capacity * (1 - catchUpBuffer));
      days.push({ date: new Date(cursor), usableCapacity: usable, remaining: usable });
    }

    cursor = new Date(cursor.getTime() + MS_PER_DAY);
    dayCount++;
  }

  return days;
}

function checkFeasibility(totalMinutes, days) {
  const totalUsable = days.reduce((sum, d) => sum + d.usableCapacity, 0);
  return {
    feasible: totalMinutes <= totalUsable,
    deficit: Math.max(0, totalMinutes - totalUsable),
  };
}

function sharesTopic(left, right) {
  const leftTopics = new Set(
    [left?.topicTag, ...(Array.isArray(left?.topicTags) ? left.topicTags : [])]
      .map(normalizeTopicKey)
      .filter(Boolean)
  );
  const rightTopics = [
    right?.topicTag,
    ...(Array.isArray(right?.topicTags) ? right.topicTags : []),
  ]
    .map(normalizeTopicKey)
    .filter(Boolean);

  return rightTopics.some((key) => leftTopics.has(key));
}

function orderStudyTasksAdaptive(studyTasks, adaptiveContext) {
  const remaining = [...studyTasks].sort((a, b) => {
    const orderA = a.sourceOrder ?? 0;
    const orderB = b.sourceOrder ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return b.difficulty - a.difficulty;
  });

  const ordered = [];
  let previous = null;
  const lookahead = adaptiveContext?.daysToExam != null && adaptiveContext.daysToExam <= 21 ? 6 : 4;

  while (remaining.length > 0) {
    const window = remaining.slice(0, Math.min(lookahead, remaining.length));
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let i = 0; i < window.length; i++) {
      const task = window[i];
      const adaptiveScore = clamp01(task.adaptiveScore ?? (task.priority || 0) / 100);
      const jumpPenalty = i * 0.09;
      const sameTopicPenalty = previous && sharesTopic(previous, task) ? 0.18 : 0;
      const score = adaptiveScore - jumpPenalty - sameTopicPenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    ordered.push(chosen);
    previous = chosen;
  }

  return ordered;
}

function placeAnchoredTasks(anchorTasks, placed, days, dayOrderMap, lastValidIdx, skipped) {
  for (const task of anchorTasks) {
    // Match study task by any overlapping sectionId (supports merged sections)
    const taskSectionSet = new Set(task.sectionIds);
    const studyTask = placed.find((t) => t.type === "STUDY" && t.sectionIds.some((id) => taskSectionSet.has(id)));
    if (!studyTask) {
      skipped.push(task);
      continue;
    }

    const studyDayIdx = days.findIndex((d) => d.date.getTime() === studyTask.dueDate.getTime());
    if (studyDayIdx === -1) {
      skipped.push(task);
      continue;
    }

    let targetIdx = Math.min(studyDayIdx + (task._dayOffset || 0), lastValidIdx);

    while (targetIdx < days.length && targetIdx <= lastValidIdx && days[targetIdx].remaining < task.estMinutes) {
      targetIdx++;
    }

    if (targetIdx > lastValidIdx || days[targetIdx].remaining < task.estMinutes) {
      skipped.push(task);
      continue;
    }

    const { _dayOffset, ...cleanTask } = task;
    const dayKey = days[targetIdx].date.getTime();
    const nextOrder = dayOrderMap.get(dayKey) || 0;
    dayOrderMap.set(dayKey, nextOrder + 1);
    placed.push({ ...cleanTask, dueDate: days[targetIdx].date, orderIndex: nextOrder });
    days[targetIdx].remaining -= task.estMinutes;
  }
}

function placeTasks(tasks, days, { examDate, adaptiveContext } = {}) {
  const maxDayCapacity = days.reduce((max, d) => Math.max(max, d.usableCapacity), 0);
  const MIN_SPLIT_CHUNK = 10; // never create a part shorter than 10 min

  /**
   * Split a task into parts that fit within daily capacities.
   * First tries to fit whole; if no day has room, splits into
   * chunks that match available remaining capacity.
   */
  const expandTask = (task) => {
    if (maxDayCapacity <= 0) return [task];
    if (task.estMinutes <= maxDayCapacity) return [task];
    const parts = [];
    let remaining = task.estMinutes;
    let part = 1;
    while (remaining > 0) {
      const chunk = Math.min(maxDayCapacity, remaining);
      if (chunk < MIN_SPLIT_CHUNK && parts.length > 0) {
        // Absorb tiny remainder into last part
        parts[parts.length - 1].estMinutes += chunk;
        break;
      }
      parts.push({
        ...task,
        estMinutes: chunk,
        title: `${task.title} (Part ${part})`,
      });
      remaining -= chunk;
      part++;
    }
    return parts;
  };

  /**
   * Place a single task, respecting daily capacity. Never overbooks.
   * If no day has enough room for the full task, splits it across days.
   * Returns true if placed (possibly split), false if completely skipped.
   */
  function placeOneTask(task, placed, startDayIndex, orderIndexMap, skipped) {
    // 1. Try to find a day with enough room starting from startDayIndex
    for (let d = startDayIndex; d < days.length; d++) {
      if (days[d].remaining >= task.estMinutes) {
        const dayKey = days[d].date.getTime();
        const order = orderIndexMap.get(dayKey) || 0;
        orderIndexMap.set(dayKey, order + 1);
        placed.push({ ...task, dueDate: days[d].date, orderIndex: order });
        days[d].remaining -= task.estMinutes;
        return d; // return the day index used
      }
    }

    // 2. No single day fits — split across multiple days
    let remaining = task.estMinutes;
    let part = 1;
    let firstDay = -1;
    for (let d = startDayIndex; d < days.length && remaining > 0; d++) {
      if (days[d].remaining <= 0) continue;
      const chunk = Math.min(days[d].remaining, remaining);
      if (chunk < MIN_SPLIT_CHUNK && remaining - chunk > 0) continue; // skip tiny slots unless it's the last piece
      const dayKey = days[d].date.getTime();
      const order = orderIndexMap.get(dayKey) || 0;
      orderIndexMap.set(dayKey, order + 1);
      placed.push({
        ...task,
        estMinutes: chunk,
        title: remaining < task.estMinutes || chunk < task.estMinutes
          ? `${task.title} (Part ${part})`
          : task.title,
        dueDate: days[d].date,
        orderIndex: order,
      });
      days[d].remaining -= chunk;
      remaining -= chunk;
      if (firstDay === -1) firstDay = d;
      part++;
    }

    if (remaining > 0) {
      // Could not place even after splitting — skip the remainder
      skipped.push({ ...task, estMinutes: remaining, title: `${task.title} (overflow)` });
    }
    return firstDay >= 0 ? firstDay : startDayIndex;
  }

  if (!adaptiveContext) {
    const studyTasks = tasks.filter((t) => t.type === "STUDY" || t.type === "QUESTIONS");
    const reviewTasks = tasks.filter((t) => t.type === "REVIEW");

    studyTasks.sort((a, b) => {
      const orderA = a.sourceOrder ?? 0;
      const orderB = b.sourceOrder ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return b.difficulty - a.difficulty;
    });

    let dayIndex = 0;
    const placed = [];
    const skipped = [];
    const dayOrderMap = new Map();

    for (const originalTask of studyTasks) {
      for (const task of expandTask(originalTask)) {
        dayIndex = placeOneTask(task, placed, dayIndex, dayOrderMap, skipped);
      }
    }

    // dayOrderMap is already populated by placeOneTask

    let lastValidIdx = days.length - 1;
    if (examDate) {
      while (lastValidIdx > 0 && days[lastValidIdx].date.getTime() > examDate.getTime()) {
        lastValidIdx--;
      }
    }

    placeAnchoredTasks(reviewTasks, placed, days, dayOrderMap, lastValidIdx, skipped);
    return { placed, skipped };
  }

  const studyTasks = tasks.filter((t) => t.type === "STUDY");
  const questionTasks = tasks.filter((t) => t.type === "QUESTIONS");
  const reviewTasks = tasks.filter((t) => t.type === "REVIEW");
  const orderedStudies = orderStudyTasksAdaptive(studyTasks, adaptiveContext);

  let dayIndex = 0;
  const placed = [];
  const skipped = [];
  const dayOrderMap = new Map();
  const newTopicsPerDay = new Map(); // date.getTime() → count of new STUDY topics
  const tasksPerDay = new Map();     // date.getTime() → total task count

  for (const originalTask of orderedStudies) {
    for (const task of expandTask(originalTask)) {
      // Try to place with scarcity awareness
      let placedDay = -1;
      for (let d = dayIndex; d < days.length; d++) {
        if (days[d].remaining < task.estMinutes) continue;
        const dayKey = days[d].date.getTime();
        const newCount = newTopicsPerDay.get(dayKey) || 0;
        const totalCount = tasksPerDay.get(dayKey) || 0;

        // Enforce scarcity caps: max new topics and max total tasks per day
        if (newCount >= MAX_NEW_TOPICS_PER_DAY || totalCount >= MAX_TASKS_PER_DAY) continue;

        const order = dayOrderMap.get(dayKey) || 0;
        dayOrderMap.set(dayKey, order + 1);
        placed.push({ ...task, dueDate: days[d].date, orderIndex: order });
        days[d].remaining -= task.estMinutes;
        newTopicsPerDay.set(dayKey, newCount + 1);
        tasksPerDay.set(dayKey, totalCount + 1);
        placedDay = d;
        break;
      }

      if (placedDay === -1) {
        // Fall back to standard placement without scarcity caps
        dayIndex = placeOneTask(task, placed, dayIndex, dayOrderMap, skipped);
      } else {
        dayIndex = placedDay;
      }
    }
  }

  let lastValidIdx = days.length - 1;
  if (examDate) {
    while (lastValidIdx > 0 && days[lastValidIdx].date.getTime() > examDate.getTime()) {
      lastValidIdx--;
    }
  }

  const orderedQuestions = [...questionTasks].sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0);
  });
  placeAnchoredTasks(orderedQuestions, placed, days, dayOrderMap, lastValidIdx, skipped);

  // Update tasksPerDay for question placement
  for (const p of placed) {
    const dk = p.dueDate.getTime();
    tasksPerDay.set(dk, (tasksPerDay.get(dk) || 0));
  }

  const orderedReviews = [...reviewTasks].sort((a, b) => {
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0);
  });
  placeAnchoredTasks(orderedReviews, placed, days, dayOrderMap, lastValidIdx, skipped);

  return { placed, skipped };
}

/**
 * When total load exceeds capacity, drop bottom-tier tasks instead of
 * extending into a mediocre, overloaded plan.
 *
 * Strategy: sort tasks by priority ascending, remove lowest-priority tasks
 * until the total load fits within available capacity. Removed tasks get
 * an exclusion reason.
 */
function pruneForDeficit(tasks, totalCapacity) {
  const totalLoad = computeTotalLoad(tasks);
  if (totalLoad <= totalCapacity) return { kept: tasks, pruned: [] };

  // Sort by priority ascending (lowest first) — prune from the bottom
  const sorted = [...tasks].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const pruned = [];
  let excess = totalLoad - totalCapacity;

  const kept = [];
  for (const task of sorted) {
    if (excess > 0 && (task.priority || 0) < 50) {
      pruned.push({
        ...task,
        _prunedReason: "Excluded: insufficient study time for low-priority content",
      });
      excess -= task.estMinutes;
    } else {
      kept.push(task);
    }
  }

  return { kept, pruned };
}

function validateScheduleInputs(startDate, examDate) {
  const errors = [];
  if (examDate && examDate.getTime() <= startDate.getTime()) {
    errors.push("Exam date must be in the future.");
  }
  return errors;
}

/**
 * Promote backlog sections to fill remaining capacity when scheduled sections
 * don't use the full study window. Promotes highest-scoring backlog sections
 * first, up to the available remaining capacity.
 *
 * This is a pure function — it returns the promoted sections without mutating
 * the inputs. The caller merges them into the scheduled set.
 *
 * @param {Object[]} backlogSections - Sections in the backlog tier.
 * @param {Map} triageResults - Per-section triage scores from triageSections.
 * @param {number} scheduledLoad - Total estMinutes already scheduled.
 * @param {number} totalCapacity - Total usable capacity across all days.
 * @returns {Object[]} Sections promoted from backlog, sorted by triage score descending.
 */
function promoteBacklog(backlogSections, triageResults, scheduledLoad, totalCapacity) {
  if (!backlogSections || backlogSections.length === 0) return [];

  const headroom = totalCapacity - scheduledLoad;
  // Only promote if there's at least 15 minutes of headroom to avoid over-packing
  if (headroom < 15) return [];

  // Sort backlog by triage score descending — best candidates first
  const sorted = [...backlogSections].sort((a, b) => {
    const scoreA = triageResults.get(a.id)?.triageScore ?? 0;
    const scoreB = triageResults.get(b.id)?.triageScore ?? 0;
    return scoreB - scoreA;
  });

  const promoted = [];
  let usedMinutes = 0;

  for (const section of sorted) {
    const sectionMinutes = section.estMinutes || 15;
    if (usedMinutes + sectionMinutes > headroom) continue;
    promoted.push(section);
    usedMinutes += sectionMinutes;
  }

  return promoted;
}

module.exports = {
  buildAdaptiveContext,
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
  validateScheduleInputs,
  // Triage v2 exports
  computeTriageScore,
  triageSections,
  isMastered,
  hasRetrievalValue,
  isThinSection,
  mergeAdjacentThinSections,
  pruneForDeficit,
  promoteBacklog,
};
