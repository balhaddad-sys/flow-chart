/**
 * Weakness-weighted question selection algorithm.
 * Used for "Random Mixed Quiz" mode to bias towards weak topics.
 */

/**
 * Compute weakness score for a topic.
 * @param {object} topicStats - { wrongAttempts, totalAttempts, daysSinceLastReview, avgTimePerQ, expectedTime }
 * @returns {number} weaknessScore between 0 and 1
 */
function computeWeaknessScore(topicStats) {
  const {
    wrongAttempts = 0,
    totalAttempts = 0,
    daysSinceLastReview = 14,
    avgTimePerQ = 0,
    expectedTime = 60,
  } = topicStats;

  const wrongRate =
    totalAttempts > 0 ? wrongAttempts / totalAttempts : 0.5;
  const recencyPenalty = Math.min(1, daysSinceLastReview / 14);
  const speedPenalty = Math.min(1, avgTimePerQ / expectedTime);

  return 0.6 * wrongRate + 0.3 * recencyPenalty + 0.1 * speedPenalty;
}

/**
 * Select questions using weakness-weighted random sampling.
 * @param {Array} questions - Array of question objects with topicTag
 * @param {Map} topicWeaknesses - Map of topicTag → weaknessScore
 * @param {number} count - Number of questions to select
 * @param {Set} recentlyAnswered - Set of questionIds answered in last 24h
 * @returns {Array} Selected questions
 */
function weightedSelect(questions, topicWeaknesses, count, recentlyAnswered = new Set()) {
  // Assign weights
  const weighted = questions.map((q) => {
    const topicTag = q.topicTags?.[0] || "unknown";
    const weakness = topicWeaknesses.get(topicTag) || 0.5;

    let recencyCooldown = 1.0;
    if (recentlyAnswered.has(q.id)) {
      recencyCooldown = 0.1;
    }

    // Never-answered questions get a boost
    const neverBoost = (q.stats?.timesAnswered || 0) === 0 ? 1.5 : 1.0;

    return {
      question: q,
      weight: weakness * recencyCooldown * neverBoost,
    };
  });

  // Weighted random sampling without replacement
  const selected = [];
  const pool = [...weighted];

  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
      random -= pool[i].weight;
      if (random <= 0) {
        selected.push(pool[i].question);
        pool.splice(i, 1);
        break;
      }
    }
  }

  return selected;
}

module.exports = { computeWeaknessScore, weightedSelect };
