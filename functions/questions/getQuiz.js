/**
 * @module questions/getQuiz
 * @description Callable function that retrieves questions for a quiz session.
 *
 * @param {Object} data
 * @param {string} data.courseId
 * @param {string} [data.sectionId] - Filter by section (mode = "section").
 * @param {string} [data.topicTag]  - Filter by topic  (mode = "topic").
 * @param {"section"|"topic"|"mixed"|"random"} [data.mode="section"]
 * @param {number} [data.count=10]  - Max questions to return (1–50).
 * @returns {{ success: true, data: { questions: object[] } }}
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { VALID_QUIZ_MODES } = require("../lib/constants");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const { shuffleArray } = require("../lib/utils");
const { weightedSelect, computeWeaknessScore } = require("./questionSelection");

exports.getQuiz = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "courseId", maxLen: 128 }]);
  const count = requireInt(data, "count", 1, 50, 10);

  await checkRateLimit(uid, "getQuiz", RATE_LIMITS.getQuiz);

  const { courseId, sectionId, topicTag } = data;
  const mode = VALID_QUIZ_MODES.has(data.mode) ? data.mode : "section";

  // SECURITY: Validate mode-specific required parameters
  // Prevents unfiltered queries that could return thousands of questions
  if (mode === "section" && !sectionId) {
    return fail(Errors.INVALID_ARGUMENT, "sectionId is required for section mode");
  }
  if (mode === "topic" && !topicTag) {
    return fail(Errors.INVALID_ARGUMENT, "topicTag is required for topic mode");
  }

  try {
    let query = db.collection(`users/${uid}/questions`).where("courseId", "==", courseId);

    if (mode === "section") {
      query = query.where("sectionId", "==", sectionId);
    } else if (mode === "topic") {
      query = query.where("topicTags", "array-contains", topicTag);
    }
    // For "mixed" or "random" modes, courseId filter is sufficient

    const snap = await query.limit(count * 3).get();

    if (snap.empty) return ok({ questions: [] });

    let questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (mode === "mixed") {
      // Weakness-weighted selection: bias towards weaker topics
      const topicWeaknesses = await buildTopicWeaknesses(uid, courseId);
      const recentlyAnswered = await getRecentlyAnswered(uid, courseId);
      questions = weightedSelect(questions, topicWeaknesses, count, recentlyAnswered);
    } else if (mode === "random") {
      questions = shuffleArray(questions);
    }

    return ok({ questions: questions.slice(0, count) });
  } catch (error) {
    return safeError(error, "quiz retrieval");
  }
});

/**
 * Build a Map of topicTag → weaknessScore from the user's recent attempts.
 */
async function buildTopicWeaknesses(uid, courseId) {
  const weaknesses = new Map();

  try {
    const attemptsSnap = await db
      .collection(`users/${uid}/attempts`)
      .where("courseId", "==", courseId)
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();

    const topicStats = {};
    const now = Date.now();

    for (const doc of attemptsSnap.docs) {
      const d = doc.data();
      const tag = d.topicTag || "unknown";

      if (!topicStats[tag]) {
        topicStats[tag] = { totalAttempts: 0, wrongAttempts: 0, lastReviewMs: 0, totalTime: 0 };
      }

      const s = topicStats[tag];
      s.totalAttempts++;
      if (!d.correct) s.wrongAttempts++;
      const ts = d.createdAt?.toMillis?.() || 0;
      if (ts > s.lastReviewMs) s.lastReviewMs = ts;
      s.totalTime += d.timeSpentSec || 0;
    }

    for (const [tag, s] of Object.entries(topicStats)) {
      const daysSinceLastReview = s.lastReviewMs
        ? (now - s.lastReviewMs) / (1000 * 60 * 60 * 24)
        : 14;
      const avgTimePerQ = s.totalAttempts > 0 ? s.totalTime / s.totalAttempts : 0;

      weaknesses.set(
        tag,
        computeWeaknessScore({
          wrongAttempts: s.wrongAttempts,
          totalAttempts: s.totalAttempts,
          daysSinceLastReview,
          avgTimePerQ,
          expectedTime: 60,
        })
      );
    }
  } catch (err) {
    console.warn("Could not build topic weaknesses:", err.message);
  }

  return weaknesses;
}

/**
 * Get set of question IDs answered in the last 24 hours.
 */
async function getRecentlyAnswered(uid, courseId) {
  const ids = new Set();

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snap = await db
      .collection(`users/${uid}/attempts`)
      .where("courseId", "==", courseId)
      .where("createdAt", ">=", cutoff)
      .limit(100)
      .get();

    for (const doc of snap.docs) {
      const qid = doc.data().questionId;
      if (qid) ids.add(qid);
    }
  } catch (err) {
    console.warn("Could not fetch recent attempts:", err.message);
  }

  return ids;
}
