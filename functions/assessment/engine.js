/**
 * @module assessment/engine
 * @description Pure helpers for adaptive assessment session generation,
 * weakness profiling, and recommendation synthesis.
 */

const { clampInt, shuffleArray } = require("../lib/utils");

const ASSESSMENT_LEVELS = Object.freeze([
  {
    id: "MD1",
    label: "MD1 (Foundations)",
    description: "Core pre-clinical recall and basic mechanisms.",
    minDifficulty: 1,
    maxDifficulty: 2,
    targetTimeSec: 80,
    recommendedDailyMinutes: 45,
  },
  {
    id: "MD2",
    label: "MD2 (Integrated Basics)",
    description: "System integration and early clinical application.",
    minDifficulty: 2,
    maxDifficulty: 3,
    targetTimeSec: 75,
    recommendedDailyMinutes: 60,
  },
  {
    id: "MD3",
    label: "MD3 (Clinical Core)",
    description: "Clinical reasoning with common presentations.",
    minDifficulty: 2,
    maxDifficulty: 4,
    targetTimeSec: 70,
    recommendedDailyMinutes: 75,
  },
  {
    id: "MD4",
    label: "MD4 (Advanced Clinical)",
    description: "Complex cases, management trade-offs, prioritization.",
    minDifficulty: 3,
    maxDifficulty: 4,
    targetTimeSec: 65,
    recommendedDailyMinutes: 90,
  },
  {
    id: "MD5",
    label: "MD5 (Senior Clinical)",
    description: "High-yield exam synthesis and advanced differentials.",
    minDifficulty: 3,
    maxDifficulty: 5,
    targetTimeSec: 60,
    recommendedDailyMinutes: 105,
  },
  {
    id: "INTERN",
    label: "Doctor Intern",
    description: "Fast, safe clinical decisions in frontline workflow.",
    minDifficulty: 3,
    maxDifficulty: 5,
    targetTimeSec: 58,
    recommendedDailyMinutes: 110,
  },
  {
    id: "RESIDENT",
    label: "Resident",
    description: "Higher-acuity management and protocol-level decisions.",
    minDifficulty: 4,
    maxDifficulty: 5,
    targetTimeSec: 55,
    recommendedDailyMinutes: 120,
  },
  {
    id: "POSTGRADUATE",
    label: "Doctor Postgraduate",
    description: "Subspecialty-level nuance and high-complexity reasoning.",
    minDifficulty: 4,
    maxDifficulty: 5,
    targetTimeSec: 50,
    recommendedDailyMinutes: 135,
  },
]);

const LEVEL_ALIASES = Object.freeze({
  MD5L: "MD5",
  MD5LEVEL: "MD5",
  DOCTORPOSTGRADUATE: "POSTGRADUATE",
  POSTGRAD: "POSTGRADUATE",
  PG: "POSTGRADUATE",
  RESIDENCY: "RESIDENT",
});

const ASSESSMENT_TOPIC_LIBRARY = Object.freeze([
  { id: "cardiology", label: "Cardiology", description: "Cardiac physiology, pathology, and management." },
  { id: "respiratory", label: "Respiratory", description: "Pulmonary medicine and gas exchange disorders." },
  { id: "renal", label: "Renal", description: "Nephrology, acid-base, and fluid-electrolyte balance." },
  { id: "gastroenterology", label: "Gastroenterology", description: "GI physiology, hepatology, and pancreatobiliary topics." },
  { id: "endocrine", label: "Endocrine", description: "Hormonal regulation and endocrine disease patterns." },
  { id: "neurology", label: "Neurology", description: "Neuroanatomy, localization, and neurological syndromes." },
  { id: "hematology", label: "Hematology", description: "Blood disorders, coagulation, and transfusion principles." },
  { id: "infectious-disease", label: "Infectious Disease", description: "Microbiology, antimicrobials, and infection control." },
  { id: "pharmacology", label: "Pharmacology", description: "Drug mechanisms, interactions, safety, and therapeutics." },
  { id: "immunology", label: "Immunology", description: "Immune mechanisms, hypersensitivity, and autoimmunity." },
  { id: "surgery", label: "Surgery", description: "Perioperative, trauma, and surgical decision-making." },
  { id: "pediatrics", label: "Pediatrics", description: "Child health, growth, and age-specific management." },
  { id: "obgyn", label: "Obstetrics & Gynecology", description: "Pregnancy, reproductive health, and gynecologic disease." },
  { id: "psychiatry", label: "Psychiatry", description: "Psychiatric diagnosis, pharmacotherapy, and crisis care." },
  { id: "emergency", label: "Emergency Medicine", description: "Acute care prioritization and emergency protocols." },
]);

const STEM_STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "then",
  "there", "these", "this", "to", "was", "were", "which", "with", "patient", "most",
  "likely", "following", "best", "next", "step", "regarding", "shows", "showing",
  "findings", "presentation", "clinical", "diagnosis", "management", "question",
]);

const GENERIC_DISTRACTOR_RE =
  /this option is incorrect|incorrect in this vignette|not the best answer|not correct/i;

function normalizeTopicTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function normalizeAssessmentLevel(level) {
  const compact = String(level || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const resolved = LEVEL_ALIASES[compact] || compact;
  const match = ASSESSMENT_LEVELS.find((item) => item.id === resolved);
  return match ? match.id : "MD3";
}

function getAssessmentLevel(level) {
  const id = normalizeAssessmentLevel(level);
  return ASSESSMENT_LEVELS.find((item) => item.id === id) || ASSESSMENT_LEVELS[2];
}

function normaliseStem(stem) {
  return String(stem || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemTokenSet(stem) {
  const tokens = normaliseStem(stem)
    .split(" ")
    .filter((token) => token.length > 2 && !STEM_STOP_WORDS.has(token));
  return new Set(tokens);
}

function stemSimilarity(stemA, stemB) {
  const a = stemTokenSet(stemA);
  const b = stemTokenSet(stemB);
  if (a.size === 0 || b.size === 0) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap++;
  }

  return overlap / Math.max(a.size, b.size);
}

function isNearDuplicateStem(stemA, stemB, threshold = 0.68) {
  const a = normaliseStem(stemA);
  const b = normaliseStem(stemB);
  if (!a || !b) return false;
  if (a === b) return true;

  if ((a.length >= 90 || b.length >= 90) && (a.includes(b) || b.includes(a))) {
    return true;
  }

  return stemSimilarity(a, b) >= threshold;
}

function deriveQuestionFocusTag(question, focusTopicTag = "") {
  const normalizedFocus = normalizeTopicTag(focusTopicTag);
  const tags = Array.isArray(question?.topicTags)
    ? question.topicTags.map(normalizeTopicTag).filter(Boolean)
    : [];

  if (tags.length === 0) return "general";

  if (normalizedFocus && tags.includes(normalizedFocus)) {
    const subtopic = tags.find((tag) => tag !== normalizedFocus && tag !== "general");
    return subtopic || normalizedFocus;
  }

  return tags[0];
}

function questionReasoningDepth(question) {
  const explanation = question?.explanation || {};
  const correctWhy = String(explanation.correctWhy || explanation.correct_why || "").trim();
  const whyOthers = Array.isArray(explanation.whyOthersWrong || explanation.why_others_wrong)
    ? (explanation.whyOthersWrong || explanation.why_others_wrong)
    : [];
  const keyTakeaway = String(explanation.keyTakeaway || explanation.key_takeaway || "").trim();
  const citations = Array.isArray(question?.citations) ? question.citations : [];

  const nonGenericDistractors = whyOthers.filter((item) => {
    const text = String(item || "").trim();
    return text.length >= 30 && !GENERIC_DISTRACTOR_RE.test(text);
  }).length;

  const correctWhyScore = Math.min(12, correctWhy.length / 22);
  const takeawayScore = Math.min(6, keyTakeaway.length / 28);
  const distractorScore = Math.min(12, nonGenericDistractors * 2.4);
  const citationScore = Math.min(6, citations.length * 2);

  return correctWhyScore + takeawayScore + distractorScore + citationScore;
}

function questionSelectionBaseScore(question, profile) {
  const difficulty = clampInt(question?.difficulty || 3, 1, 5);
  const midpoint = (profile.minDifficulty + profile.maxDifficulty) / 2;
  const inBand = difficulty >= profile.minDifficulty && difficulty <= profile.maxDifficulty;
  const fitScore = inBand
    ? 26 - Math.abs(difficulty - midpoint) * 4
    : Math.max(4, 14 - Math.abs(difficulty - midpoint) * 6);
  const optionCountScore = Array.isArray(question?.options) && question.options.length >= 4 ? 4 : 0;

  return fitScore + optionCountScore + questionReasoningDepth(question);
}

function dynamicQuestionScore(question, profile, focusTopicTag, tagUsage, sectionUsage) {
  const tagKey = deriveQuestionFocusTag(question, focusTopicTag);
  const sectionKey = String(
    question?.sectionId ||
    question?.sourceRef?.sectionId ||
    "unknown"
  );
  const diversityPenalty = (tagUsage.get(tagKey) || 0) * 9 + (sectionUsage.get(sectionKey) || 0) * 6;
  return questionSelectionBaseScore(question, profile) - diversityPenalty;
}

function selectAssessmentQuestions(questions, { level, count = 20, focusTopicTag = "" } = {}) {
  const profile = getAssessmentLevel(level);
  const safeCount = clampInt(count, 5, 40);
  const valid = questions.filter(
    (q) =>
      q &&
      typeof q.id === "string" &&
      typeof q.stem === "string" &&
      Array.isArray(q.options) &&
      q.options.length >= 2
  );

  const inBand = valid.filter((q) => q.difficulty >= profile.minDifficulty && q.difficulty <= profile.maxDifficulty);
  const nearBand = valid.filter(
    (q) =>
      !inBand.includes(q) &&
      q.difficulty >= Math.max(1, profile.minDifficulty - 1) &&
      q.difficulty <= Math.min(5, profile.maxDifficulty + 1)
  );
  const farBand = valid.filter((q) => !inBand.includes(q) && !nearBand.includes(q));

  const pools = [shuffleArray(inBand), shuffleArray(nearBand), shuffleArray(farBand)];
  const selected = [];
  const selectedIds = new Set();
  const selectedStems = [];
  const tagUsage = new Map();
  const sectionUsage = new Map();

  function registerSelection(question) {
    selected.push(question);
    selectedIds.add(question.id);
    selectedStems.push(String(question.stem || ""));

    const tagKey = deriveQuestionFocusTag(question, focusTopicTag);
    const sectionKey = String(question.sectionId || question.sourceRef?.sectionId || "unknown");
    tagUsage.set(tagKey, (tagUsage.get(tagKey) || 0) + 1);
    sectionUsage.set(sectionKey, (sectionUsage.get(sectionKey) || 0) + 1);
  }

  function pickRound(similarityThreshold) {
    let pickedAny = true;

    while (selected.length < safeCount && pickedAny) {
      pickedAny = false;

      for (const pool of pools) {
        if (selected.length >= safeCount) break;

        const candidates = pool
          .filter((question) => !selectedIds.has(question.id))
          .sort(
            (a, b) =>
              dynamicQuestionScore(b, profile, focusTopicTag, tagUsage, sectionUsage) -
              dynamicQuestionScore(a, profile, focusTopicTag, tagUsage, sectionUsage)
          );

        const candidate = candidates.find((question) =>
          !selectedStems.some((stem) => isNearDuplicateStem(question.stem, stem, similarityThreshold))
        );

        if (!candidate) continue;
        registerSelection(candidate);
        pickedAny = true;
      }
    }
  }

  // Strong duplicate filtering first, then progressively relaxed if needed.
  pickRound(0.62);
  if (selected.length < safeCount) pickRound(0.7);
  if (selected.length < safeCount) pickRound(0.78);

  if (selected.length < safeCount) {
    const fallback = shuffleArray(valid).sort(
      (a, b) =>
        dynamicQuestionScore(b, profile, focusTopicTag, tagUsage, sectionUsage) -
        dynamicQuestionScore(a, profile, focusTopicTag, tagUsage, sectionUsage)
    );

    for (const question of fallback) {
      if (selected.length >= safeCount) break;
      if (selectedIds.has(question.id)) continue;
      if (selectedStems.some((stem) => isNearDuplicateStem(question.stem, stem, 0.88))) continue;
      registerSelection(question);
    }
  }

  return selected;
}

function computeWeaknessProfile(responses, questionMap, level, options = {}) {
  const profile = getAssessmentLevel(level);
  const focusTopicTag = normalizeTopicTag(options.focusTopicTag || "");
  const topicStats = new Map();

  let totalCorrect = 0;
  let totalTime = 0;

  for (const response of responses) {
    const question = questionMap.get(response.questionId);
    if (!question) continue;

    const timeSpentSec = clampInt(response.timeSpentSec || profile.targetTimeSec, 0, 3600);
    const confidence = response.confidence == null ? null : clampInt(response.confidence, 1, 5);
    const correct = response.correct === true;
    if (correct) totalCorrect++;
    totalTime += timeSpentSec;

    const tag = deriveQuestionFocusTag(question, focusTopicTag);
    const current = topicStats.get(tag) || {
      tag,
      attempts: 0,
      correct: 0,
      totalTimeSec: 0,
      confidenceSum: 0,
      confidenceCount: 0,
      weightedMiss: 0,
    };

    current.attempts++;
    current.totalTimeSec += timeSpentSec;
    if (correct) current.correct++;
    if (!correct) {
      const difficultyWeight = Math.max(1, Math.min(5, question.difficulty || 3)) / 5;
      current.weightedMiss += difficultyWeight;
    }
    if (confidence != null) {
      current.confidenceSum += confidence;
      current.confidenceCount++;
    }

    topicStats.set(tag, current);
  }

  const topicBreakdown = [...topicStats.values()]
    .map((topic) => {
      const accuracy = topic.attempts > 0 ? topic.correct / topic.attempts : 0;
      const avgTimeSec = topic.attempts > 0 ? topic.totalTimeSec / topic.attempts : 0;
      const avgConfidence = topic.confidenceCount > 0 ? topic.confidenceSum / topic.confidenceCount : null;
      const errorRate = 1 - accuracy;
      const slowPenalty = Math.max(0, Math.min(1, avgTimeSec / profile.targetTimeSec - 1));
      const confidencePenalty = avgConfidence == null
        ? 0.45
        : Math.max(0, Math.min(1, (3.5 - avgConfidence) / 2.5));
      const difficultyPenalty = topic.attempts > 0 ? Math.min(1, topic.weightedMiss / topic.attempts) : 0;
      const weaknessScore = Number(
        (0.55 * errorRate + 0.2 * slowPenalty + 0.15 * confidencePenalty + 0.1 * difficultyPenalty).toFixed(3)
      );

      let severity = "STRONG";
      if (weaknessScore >= 0.65) severity = "CRITICAL";
      else if (weaknessScore >= 0.45) severity = "REINFORCE";

      return {
        tag: topic.tag,
        attempts: topic.attempts,
        accuracy: Number((accuracy * 100).toFixed(1)),
        avgTimeSec: Math.round(avgTimeSec),
        avgConfidence: avgConfidence == null ? null : Number(avgConfidence.toFixed(2)),
        weaknessScore,
        severity,
      };
    })
    .sort((a, b) => b.weaknessScore - a.weaknessScore);

  const answeredCount = responses.length;
  const overallAccuracy = answeredCount > 0 ? totalCorrect / answeredCount : 0;
  const avgTimeSec = answeredCount > 0 ? totalTime / answeredCount : 0;
  const meanWeakness = topicBreakdown.length > 0
    ? topicBreakdown.reduce((sum, t) => sum + t.weaknessScore, 0) / topicBreakdown.length
    : 1;
  const readinessScore = Math.max(
    0,
    Math.min(100, Math.round((overallAccuracy * 0.7 + (1 - meanWeakness) * 0.3) * 100))
  );

  return {
    level: profile.id,
    targetTimeSec: profile.targetTimeSec,
    recommendedDailyMinutes: profile.recommendedDailyMinutes,
    answeredCount,
    overallAccuracy: Number((overallAccuracy * 100).toFixed(1)),
    avgTimeSec: Math.round(avgTimeSec),
    readinessScore,
    topicBreakdown,
  };
}

function buildRecommendationPlan(profile) {
  const weakTopics = profile.topicBreakdown.filter((topic) => topic.severity !== "STRONG").slice(0, 4);

  if (weakTopics.length === 0) {
    return {
      summary: "Performance is stable across this topic. Keep momentum with mixed, timed practice.",
      priorityTopics: [],
      actions: [
        {
          title: "Maintain exam stamina",
          focusTag: "mixed-review",
          rationale: "No critical weakness clusters detected.",
          recommendedMinutes: Math.round(profile.recommendedDailyMinutes * 0.75),
          drills: [
            "Run one timed mixed set every 2 days.",
            "Review all incorrect items and rewrite key takeaways.",
            "Re-assess the same topic in 5-7 days.",
          ],
        },
      ],
      examTips: [
        "Prioritize timing discipline: do not spend >2x target time on one item.",
        "Keep a one-page error log and revisit before each test.",
      ],
    };
  }

  const actions = weakTopics.map((topic) => {
    const severityMultiplier = topic.severity === "CRITICAL" ? 1.2 : 1.0;
    const recommendedMinutes = Math.round(
      Math.max(25, (profile.recommendedDailyMinutes * 0.4 + topic.weaknessScore * 30) * severityMultiplier)
    );

    // Build drills tailored to the topic's specific weakness pattern
    const drills = [];
    if (topic.accuracy < 40) {
      drills.push(`Your ${topic.tag} accuracy is ${topic.accuracy}% — revisit the core concepts before quizzing. Focus on understanding mechanisms, not memorizing answers.`);
    } else if (topic.accuracy < 60) {
      drills.push(`At ${topic.accuracy}% accuracy in ${topic.tag}, you're close. Do a focused 15-question quiz on this topic and review each wrong answer in detail.`);
    } else {
      drills.push(`${topic.tag} is at ${topic.accuracy}% — strengthen it with a timed quiz (${profile.targetTimeSec}s per question) focusing on the subtopics you missed.`);
    }

    if (topic.avgTimeSec > profile.targetTimeSec * 1.5) {
      drills.push(`You're averaging ${topic.avgTimeSec}s per question vs the ${profile.targetTimeSec}s target. Practice under timed conditions to build speed.`);
    }

    if (topic.severity === "CRITICAL") {
      drills.push(`This is a critical gap. Dedicate ${recommendedMinutes} minutes daily to ${topic.tag} until accuracy exceeds 70%. Retest after 48 hours.`);
    } else {
      drills.push(`Schedule a ${topic.tag} review session, then retest in 2-3 days to confirm retention.`);
    }

    return {
      title: topic.severity === "CRITICAL" ? `Fix: ${topic.tag}` : `Strengthen: ${topic.tag}`,
      focusTag: topic.tag,
      rationale: `${topic.accuracy}% accuracy across ${topic.attempts} question${topic.attempts === 1 ? "" : "s"}${topic.avgTimeSec > profile.targetTimeSec ? `, avg ${topic.avgTimeSec}s (target: ${profile.targetTimeSec}s)` : ""}.`,
      recommendedMinutes,
      drills,
    };
  });

  const topTag = weakTopics[0]?.tag || "your weakest topic";
  return {
    summary: `${weakTopics.length} weak area${weakTopics.length === 1 ? "" : "s"} found. Focus on ${topTag} first — it has the biggest impact on your readiness score.`,
    priorityTopics: weakTopics.map((topic) => topic.tag),
    actions,
    examTips: [
      `Start each study session with ${topTag} while your focus is sharpest.`,
      "For questions you got wrong, write one sentence explaining why the correct answer is right.",
      `Aim for ${profile.targetTimeSec}s per question — being too slow costs marks in real exams.`,
    ],
  };
}

module.exports = {
  ASSESSMENT_LEVELS,
  ASSESSMENT_TOPIC_LIBRARY,
  normalizeTopicTag,
  normalizeAssessmentLevel,
  getAssessmentLevel,
  selectAssessmentQuestions,
  computeWeaknessProfile,
  buildRecommendationPlan,
};
