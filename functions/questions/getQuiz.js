const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Callable: Fetch questions for a quiz session.
 * Supports filtering by section, topic, or random mixed mode.
 */
exports.getQuiz = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be logged in"
    );
  }

  const uid = context.auth.uid;
  const { courseId, sectionId, topicTag, mode = "section", count = 10 } = data;

  if (!courseId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "courseId is required"
    );
  }

  try {
    let query = db
      .collection(`users/${uid}/questions`)
      .where("courseId", "==", courseId);

    if (mode === "section" && sectionId) {
      query = query.where("sectionId", "==", sectionId);
    } else if (mode === "topic" && topicTag) {
      query = query.where("topicTags", "array-contains", topicTag);
    }

    const snap = await query.limit(count * 2).get(); // Fetch extra for sampling

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

    // For mixed mode, shuffle and sample
    if (mode === "mixed" || mode === "random") {
      questions = shuffleArray(questions);
    }

    // Limit to requested count
    questions = questions.slice(0, count);

    return {
      success: true,
      data: { questions },
    };
  } catch (error) {
    console.error("getQuiz error:", error);
    return {
      success: false,
      error: { code: "INTERNAL", message: error.message },
    };
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
