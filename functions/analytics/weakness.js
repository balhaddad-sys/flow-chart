/**
 * @module analytics/weakness
 * @description Pure weakness analysis — no Firebase dependencies.
 *
 * Extracted from `computeWeakness` so the statistical logic can be tested
 * without mocking Firestore.  All functions are pure transformations.
 *
 * Weakness formula (per topic):
 *   score = 0.6 * errorRate + 0.3 * recencyPenalty + 0.1 * speedPenalty
 */

const { MS_PER_DAY, WEAK_TOPICS_LIMIT } = require("../lib/constants");
const { computeWeaknessScore } = require("../questions/questionSelection");

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} AttemptRecord
 * @property {string}  questionId
 * @property {boolean} correct
 * @property {number}  [timeSpentSec]
 * @property {{ toDate?: () => Date }} [createdAt]
 */

/**
 * @typedef {Object} QuestionRecord
 * @property {string[]} [topicTags]
 */

/**
 * @typedef {Object} TopicStats
 * @property {number}    totalAttempts
 * @property {number}    wrongAttempts
 * @property {number}    totalTimeSec
 * @property {Date|null} lastAttemptDate
 */

/**
 * @typedef {Object} WeakTopic
 * @property {string} tag
 * @property {number} weaknessScore
 * @property {number} accuracy
 */

// ── Core functions ───────────────────────────────────────────────────────────

/**
 * Accumulate per-topic statistics from a set of attempts and their questions.
 *
 * @param {AttemptRecord[]} attempts
 * @param {Map<string, QuestionRecord>} questionMap - questionId → question data.
 * @returns {Map<string, TopicStats>}
 */
function accumulateTopicStats(attempts, questionMap) {
  const topicMap = new Map();

  for (const att of attempts) {
    const question = questionMap.get(att.questionId);
    if (!question) continue;

    for (const tag of question.topicTags || []) {
      if (!topicMap.has(tag)) {
        topicMap.set(tag, { totalAttempts: 0, wrongAttempts: 0, totalTimeSec: 0, lastAttemptDate: null });
      }
      const t = topicMap.get(tag);
      t.totalAttempts++;
      if (!att.correct) t.wrongAttempts++;
      t.totalTimeSec += att.timeSpentSec || 0;

      const attemptDate = att.createdAt?.toDate?.() || new Date();
      if (!t.lastAttemptDate || attemptDate > t.lastAttemptDate) {
        t.lastAttemptDate = attemptDate;
      }
    }
  }

  return topicMap;
}

/**
 * Rank topics by weakness score and return the weakest N.
 *
 * @param {Map<string, TopicStats>} topicMap
 * @param {Date}   [now=new Date()]
 * @param {number} [limit=WEAK_TOPICS_LIMIT]
 * @returns {WeakTopic[]}
 */
function rankWeakTopics(topicMap, now = new Date(), limit = WEAK_TOPICS_LIMIT) {
  const results = [];

  for (const [tag, stats] of topicMap.entries()) {
    const daysSinceLastReview = stats.lastAttemptDate
      ? Math.floor((now - stats.lastAttemptDate) / MS_PER_DAY)
      : 14;
    const avgTimePerQ = stats.totalAttempts > 0 ? stats.totalTimeSec / stats.totalAttempts : 0;

    const weaknessScore = computeWeaknessScore({
      wrongAttempts: stats.wrongAttempts,
      totalAttempts: stats.totalAttempts,
      daysSinceLastReview,
      avgTimePerQ,
      expectedTime: 60,
    });

    const accuracy = stats.totalAttempts > 0
      ? (stats.totalAttempts - stats.wrongAttempts) / stats.totalAttempts
      : 0;

    results.push({ tag, weaknessScore, accuracy });
  }

  results.sort((a, b) => b.weaknessScore - a.weaknessScore);
  return results.slice(0, limit);
}

/**
 * Compute overall course stats from a list of attempts.
 *
 * @param {AttemptRecord[]} attempts
 * @returns {{ totalAnswered: number, totalCorrect: number, overallAccuracy: number }}
 */
function computeOverallAccuracy(attempts) {
  const totalAnswered = attempts.length;
  const totalCorrect = attempts.filter((a) => a.correct).length;
  const overallAccuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;
  return { totalAnswered, totalCorrect, overallAccuracy };
}

/**
 * Compute study minutes and completion rate from task data.
 *
 * @param {Array<{ status: string, actualMinutes?: number, estMinutes?: number }>} tasks
 * @returns {{ totalStudyMinutes: number, completedTasks: number, totalTasks: number, completionPercent: number }}
 */
function computeCompletionStats(tasks) {
  let totalStudyMinutes = 0;
  let completedTasks = 0;

  for (const t of tasks) {
    if (t.status === "DONE") {
      totalStudyMinutes += t.actualMinutes || t.estMinutes || 0;
      completedTasks++;
    }
  }

  return {
    totalStudyMinutes,
    completedTasks,
    totalTasks: tasks.length,
    completionPercent: tasks.length > 0 ? completedTasks / tasks.length : 0,
  };
}

module.exports = {
  accumulateTopicStats,
  rankWeakTopics,
  computeOverallAccuracy,
  computeCompletionStats,
};
