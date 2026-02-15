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

function selectAssessmentQuestions(questions, { level, count = 20 }) {
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

  const selection = [];
  selection.push(...shuffleArray(inBand).slice(0, safeCount));
  if (selection.length < safeCount) {
    const need = safeCount - selection.length;
    selection.push(...shuffleArray(nearBand).slice(0, need));
  }
  if (selection.length < safeCount) {
    const need = safeCount - selection.length;
    selection.push(...shuffleArray(farBand).slice(0, need));
  }

  return selection;
}

function computeWeaknessProfile(responses, questionMap, level) {
  const profile = getAssessmentLevel(level);
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

    const tags = Array.isArray(question.topicTags) && question.topicTags.length > 0
      ? question.topicTags.map(normalizeTopicTag)
      : ["general"];
    const uniqueTags = [...new Set(tags)];

    for (const tag of uniqueTags) {
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
    return {
      title: `Remediate ${topic.tag}`,
      focusTag: topic.tag,
      rationale: `Accuracy ${topic.accuracy}% with weakness score ${topic.weaknessScore}.`,
      recommendedMinutes,
      drills: [
        "Do a focused quiz on this tag with 12-20 questions.",
        "Review every incorrect option and summarize why it is wrong.",
        "Repeat a short retest after 48 hours to lock retention.",
      ],
    };
  });

  return {
    summary: `Detected ${weakTopics.length} priority weakness area${weakTopics.length === 1 ? "" : "s"} requiring targeted remediation.`,
    priorityTopics: weakTopics.map((topic) => topic.tag),
    actions,
    examTips: [
      "Start sessions with your highest-weakness tag while cognitive energy is fresh.",
      "Track confidence on each answer; low-confidence correct answers still need review.",
      "Target pace near your level benchmark while preserving accuracy.",
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
