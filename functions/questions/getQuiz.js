const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");

const db = admin.firestore();

const VALID_MODES = new Set(["section", "topic", "mixed", "random"]);

/**
 * Callable: Fetch questions for a quiz session.
 * Supports filtering by section, topic, or random mixed mode.
 */
exports.getQuiz = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "courseId", maxLen: 128 }]);
  const count = requireInt(data, "count", 1, 50, 10);

  await checkRateLimit(uid, "getQuiz", RATE_LIMITS.getQuiz);

  const { courseId, sectionId, topicTag } = data;
  const mode = VALID_MODES.has(data.mode) ? data.mode : "section";

  try {
    let query = db
      .collection(`users/${uid}/questions`)
      .where("courseId", "==", courseId);

    if (mode === "section" && sectionId) {
      query = query.where("sectionId", "==", sectionId);
    } else if (mode === "topic" && topicTag) {
      query = query.where("topicTags", "array-contains", topicTag);
    }

    const snap = await query.limit(count * 2).get();

    if (snap.empty) {
      return {
        success: true,
        data: { questions: [] },
      };
    }

    let questions = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    if (mode === "mixed" || mode === "random") {
      questions = shuffleArray(questions);
    }

    questions = questions.slice(0, count);

    return {
      success: true,
      data: { questions },
    };
  } catch (error) {
    return safeError(error, "quiz retrieval");
  }
});

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
