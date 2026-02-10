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
const { ok, safeError } = require("../lib/errors");
const { shuffleArray } = require("../lib/utils");

exports.getQuiz = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "courseId", maxLen: 128 }]);
  const count = requireInt(data, "count", 1, 50, 10);

  await checkRateLimit(uid, "getQuiz", RATE_LIMITS.getQuiz);

  const { courseId, sectionId, topicTag } = data;
  const mode = VALID_QUIZ_MODES.has(data.mode) ? data.mode : "section";

  try {
    let query = db.collection(`users/${uid}/questions`).where("courseId", "==", courseId);

    if (mode === "section" && sectionId) {
      query = query.where("sectionId", "==", sectionId);
    } else if (mode === "topic" && topicTag) {
      query = query.where("topicTags", "array-contains", topicTag);
    }

    const snap = await query.limit(count * 2).get();

    if (snap.empty) return ok({ questions: [] });

    let questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (mode === "mixed" || mode === "random") {
      questions = shuffleArray(questions);
    }

    return ok({ questions: questions.slice(0, count) });
  } catch (error) {
    return safeError(error, "quiz retrieval");
  }
});
