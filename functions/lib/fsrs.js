/**
 * @module lib/fsrs
 * @description Pure FSRS v5 (Free Spaced Repetition Scheduler) algorithm.
 *
 * No Firebase or external dependencies — all functions are pure transformations
 * of plain objects, fully unit-testable.
 *
 * Based on the open-source FSRS v5 algorithm by Jarrett Ye, trained on 500M+
 * Anki reviews. Reference: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * Card states: New → Learning → Review ↔ Relearning
 * Grades: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
 */

"use strict";

// ── FSRS v5 default weights (19 parameters) ────────────────────────────────
// Trained on 500M+ reviews. These are the published FSRS v5 defaults.
const FSRS_WEIGHTS = [
  0.4072, 1.1829, 3.1262, 15.4722, // w0-w3: initial stability per grade (Again, Hard, Good, Easy)
  7.2102, 0.5316, 1.0651,           // w4-w6: difficulty params (base, grade scaling, update rate)
  0.0589, 1.5330, 0.1544, 1.0070,   // w7: mean reversion, w8-w10: recall stability factors
  1.9395, 0.1100, 0.2970, 2.2693,   // w11-w14: forget stability factors
  0.2315, 2.9898,                    // w15: hard penalty, w16: easy bonus
  0.5163, 0.6571,                    // w17-w18: short-term stability params
];

const CARD_STATES = { New: "New", Learning: "Learning", Review: "Review", Relearning: "Relearning" };
const GRADE = { Again: 1, Hard: 2, Good: 3, Easy: 4 };

// ── Helper: clamp value to [lo, hi] ────────────────────────────────────────
function clamp(value, lo, hi) {
  return Math.min(hi, Math.max(lo, value));
}

// ── Retrievability ──────────────────────────────────────────────────────────
/**
 * Probability of recall after `elapsedDays` with stability `S`.
 * FSRS power-law forgetting curve: R = (1 + t/(9·S))^(-1)
 *
 * @param {number} elapsedDays - Days since last review (t)
 * @param {number} stability   - Memory stability in days (S)
 * @returns {number} Recall probability [0, 1]
 */
function retrievability(elapsedDays, stability) {
  if (stability <= 0) return 0;
  if (elapsedDays <= 0) return 1;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

// ── Next interval ───────────────────────────────────────────────────────────
/**
 * Compute the optimal interval for a desired retention rate.
 * Inverse of the retrievability formula: I = S · 9 · (1/r - 1)
 *
 * @param {number} stability          - Memory stability (S)
 * @param {number} desiredRetention   - Target recall probability (e.g. 0.9)
 * @param {number} [minInterval=1]    - Floor
 * @param {number} [maxInterval=365]  - Ceiling
 * @returns {number} Interval in days (integer)
 */
function nextInterval(stability, desiredRetention, minInterval = 1, maxInterval = 365) {
  if (stability <= 0 || desiredRetention <= 0 || desiredRetention >= 1) return minInterval;
  const interval = stability * 9 * (1 / desiredRetention - 1);
  return clamp(Math.round(interval), minInterval, maxInterval);
}

// ── Initial stability for new cards ─────────────────────────────────────────
/**
 * Initial stability S0 for a new card, based on first-review grade.
 * Uses weights w0-w3 (one per grade).
 *
 * @param {number} grade - 1 (Again) to 4 (Easy)
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {number} Initial stability
 */
function initStability(grade, w = FSRS_WEIGHTS) {
  const idx = clamp(grade, 1, 4) - 1; // grade 1 → w[0], grade 4 → w[3]
  return Math.max(0.1, w[idx]);
}

// ── Initial difficulty for new cards ────────────────────────────────────────
/**
 * Initial difficulty D0, based on first-review grade.
 * D0 = w4 - exp(w5 · (grade - 1)) + 1
 *
 * @param {number} grade
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {number} Difficulty [1, 10]
 */
function initDifficulty(grade, w = FSRS_WEIGHTS) {
  const d = w[4] - Math.exp(w[5] * (grade - 1)) + 1;
  return clamp(d, 1, 10);
}

// ── Next difficulty (mean-reversion update) ─────────────────────────────────
/**
 * Update difficulty after a review. Uses mean-reversion toward initial D.
 * D' = w7 · D0(3) + (1 - w7) · (D - w6 · (grade - 3))
 *
 * @param {number} D     - Current difficulty
 * @param {number} grade - Review grade 1-4
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {number} Updated difficulty [1, 10]
 */
function nextDifficulty(D, grade, w = FSRS_WEIGHTS) {
  const d0Mean = initDifficulty(3, w); // anchor toward "Good" difficulty
  const dPrime = w[7] * d0Mean + (1 - w[7]) * (D - w[6] * (grade - 3));
  return clamp(dPrime, 1, 10);
}

// ── Stability after successful recall ───────────────────────────────────────
/**
 * Core FSRS v5 stability update after a successful recall (grade >= 2).
 * S'_r = S · (1 + exp(w8) · (11 - D) · S^(-w9) · (exp(w10 · (1 - R)) - 1) · hardPenalty · easyBonus)
 *
 * @param {number} D     - Difficulty
 * @param {number} S     - Current stability
 * @param {number} R     - Retrievability at time of review
 * @param {number} grade - 2 (Hard), 3 (Good), 4 (Easy)
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {number} New stability (>= S for successful recall)
 */
function recallStability(D, S, R, grade, w = FSRS_WEIGHTS) {
  const hardPenalty = grade === GRADE.Hard ? w[15] : 1;
  const easyBonus = grade === GRADE.Easy ? w[16] : 1;

  const sPrime =
    S *
    (1 +
      Math.exp(w[8]) *
        (11 - D) *
        Math.pow(S, -w[9]) *
        (Math.exp(w[10] * (1 - R)) - 1) *
        hardPenalty *
        easyBonus);

  return Math.max(0.1, sPrime);
}

// ── Stability after a lapse (forgot) ────────────────────────────────────────
/**
 * Stability after forgetting (grade = Again/1).
 * S'_f = w11 · D^(-w12) · ((S + 1)^w13 - 1) · exp(w14 · (1 - R))
 *
 * @param {number} D - Difficulty
 * @param {number} S - Current stability
 * @param {number} R - Retrievability at time of review
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {number} New stability (typically < S — memory weakened)
 */
function forgetStability(D, S, R, w = FSRS_WEIGHTS) {
  const sPrime =
    w[11] *
    Math.pow(D, -w[12]) *
    (Math.pow(S + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - R));

  return clamp(sPrime, 0.1, S); // never exceed previous stability after a lapse
}

// ── Main: review a card ─────────────────────────────────────────────────────
/**
 * Process a single review and return the updated card state.
 *
 * @param {Object} card           - Current SRS card state
 * @param {number} grade          - FSRS grade 1-4
 * @param {number} elapsedDays    - Days since last review (0 for new cards)
 * @param {number} desiredRetention - Target recall probability (e.g. 0.9)
 * @param {number} [minInterval=1]
 * @param {number} [maxInterval=365]
 * @param {number[]} [w=FSRS_WEIGHTS]
 * @returns {Object} Updated card with new stability, difficulty, interval, state, nextReview
 */
function reviewCard(card, grade, elapsedDays, desiredRetention, minInterval = 1, maxInterval = 365, w = FSRS_WEIGHTS) {
  const g = clamp(Math.round(grade), 1, 4);
  const now = new Date();
  let newCard;

  if (card.state === CARD_STATES.New || card.reps === 0) {
    // ── First review of a new card ──────────────────────────────────────
    const S = initStability(g, w);
    const D = initDifficulty(g, w);
    const interval = nextInterval(S, desiredRetention, minInterval, maxInterval);

    newCard = {
      state: g === GRADE.Again ? CARD_STATES.Learning : CARD_STATES.Review,
      stability: S,
      difficulty: D,
      reps: 1,
      lapses: g === GRADE.Again ? 1 : 0,
      interval,
      lastReview: now,
    };
  } else {
    // ── Subsequent review ───────────────────────────────────────────────
    const R = retrievability(elapsedDays, card.stability);

    if (g === GRADE.Again) {
      // Lapse — memory failed
      const S = forgetStability(card.difficulty, card.stability, R, w);
      const D = nextDifficulty(card.difficulty, g, w);
      const interval = nextInterval(S, desiredRetention, minInterval, maxInterval);

      newCard = {
        state: CARD_STATES.Relearning,
        stability: S,
        difficulty: D,
        reps: card.reps + 1,
        lapses: card.lapses + 1,
        interval,
        lastReview: now,
      };
    } else {
      // Successful recall (Hard/Good/Easy)
      const S = recallStability(card.difficulty, card.stability, R, g, w);
      const D = nextDifficulty(card.difficulty, g, w);
      const interval = nextInterval(S, desiredRetention, minInterval, maxInterval);

      newCard = {
        state: CARD_STATES.Review,
        stability: S,
        difficulty: D,
        reps: card.reps + 1,
        lapses: card.lapses,
        interval,
        lastReview: now,
      };
    }
  }

  // Compute next review date
  newCard.nextReview = new Date(now.getTime() + newCard.interval * 86_400_000);

  return newCard;
}

// ── Create a blank SRS card ─────────────────────────────────────────────────
/**
 * Create a new blank SRS card for a section.
 *
 * @param {string} sectionId
 * @param {string} courseId
 * @returns {Object} Initial card state
 */
function createBlankCard(sectionId, courseId) {
  return {
    sectionId,
    courseId,
    state: CARD_STATES.New,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    interval: 0,
    lastReview: null,
    nextReview: null,
  };
}

// ── Grade from quiz performance ─────────────────────────────────────────────
/**
 * Map quiz performance metrics to an FSRS grade (1-4).
 *
 * | Grade | Meaning | Condition                                              |
 * |-------|---------|--------------------------------------------------------|
 * | 1     | Again   | accuracy < 0.40                                        |
 * | 2     | Hard    | accuracy 0.40-0.65, OR very slow (>90s avg)            |
 * | 3     | Good    | accuracy 0.65-0.90                                     |
 * | 4     | Easy    | accuracy > 0.90 AND fast (<30s avg) AND confidence ≥ 4 |
 *
 * @param {number} accuracy      - Fraction correct [0, 1]
 * @param {number} avgTimeSec    - Average seconds per question
 * @param {number} avgConfidence - Average confidence 1-5 (0 if not available)
 * @returns {number} FSRS grade 1-4
 */
function gradeFromPerformance(accuracy, avgTimeSec, avgConfidence) {
  const acc = clamp(accuracy, 0, 1);
  const time = Math.max(0, avgTimeSec || 0);
  const conf = clamp(avgConfidence || 0, 0, 5);

  // Again: clearly failed
  if (acc < 0.40) return GRADE.Again;

  // Easy: high accuracy + fast + confident
  if (acc > 0.90 && time > 0 && time < 30 && conf >= 4) return GRADE.Easy;

  // Hard: low-medium accuracy or very slow
  if (acc < 0.65 || (time > 90 && acc < 0.80)) return GRADE.Hard;

  // Good: everything else
  return GRADE.Good;
}

module.exports = {
  FSRS_WEIGHTS,
  CARD_STATES,
  GRADE,
  clamp,
  retrievability,
  nextInterval,
  initStability,
  initDifficulty,
  nextDifficulty,
  recallStability,
  forgetStability,
  reviewCard,
  createBlankCard,
  gradeFromPerformance,
};
