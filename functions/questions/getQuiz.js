/**
 * @module questions/getQuiz
 * @description Callable function that retrieves a set of questions for an
 * interactive quiz session.
 *
 * Supports four modes:
 *  - `section` — questions from a specific section.
 *  - `topic`   — questions matching a topic tag.
 *  - `mixed`   — random questions across topics (shuffled).
 *  - `random`  — alias for mixed.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings, requireInt, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { VALID_QUIZ_MODES } = require("../lib/constants");
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

    if (snap.empty) {
      return { success: true, data: { questions: [] } };
    }

    let questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    if (mode === "mixed" || mode === "random") {
      questions = shuffleArray(questions);
    }

    return { success: true, data: { questions: questions.slice(0, count) } };
  } catch (error) {
    return safeError(error, "quiz retrieval");
  }
});
