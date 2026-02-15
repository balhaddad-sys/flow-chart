/**
 * @module assessment/startAssessmentSession
 * @description Callable function that starts a topic/level diagnostic
 * assessment and returns a curated question set.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const {
  normalizeTopicTag,
  normalizeAssessmentLevel,
  getAssessmentLevel,
  selectAssessmentQuestions,
} = require("./engine");

exports.startAssessmentSession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [
    { field: "courseId", maxLen: 128 },
    { field: "topicTag", maxLen: 128 },
    { field: "level", maxLen: 64 },
  ]);
  const questionCount = requireInt(data, "questionCount", 5, 40, 15);

  await checkRateLimit(uid, "startAssessmentSession", RATE_LIMITS.startAssessmentSession);

  try {
    const { courseId } = data;
    const rawTopicTag = String(data.topicTag || "").trim();
    if (!rawTopicTag) {
      return fail(Errors.INVALID_ARGUMENT, "topicTag must be a non-empty string.");
    }
    const normalizedTopicTag = normalizeTopicTag(rawTopicTag);
    const level = normalizeAssessmentLevel(data.level);
    const levelProfile = getAssessmentLevel(level);

    let questionSnap = await db
      .collection(`users/${uid}/questions`)
      .where("courseId", "==", courseId)
      .where("topicTags", "array-contains", rawTopicTag)
      .limit(300)
      .get();

    let questions = questionSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (questions.length === 0) {
      // Fallback: case/format insensitive scan when topic casing differs.
      questionSnap = await db
        .collection(`users/${uid}/questions`)
        .where("courseId", "==", courseId)
        .limit(300)
        .get();

      questions = questionSnap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((question) =>
          Array.isArray(question.topicTags) &&
          question.topicTags.some((tag) => normalizeTopicTag(tag) === normalizedTopicTag)
        );
    }

    if (questions.length === 0) {
      return fail(
        Errors.NOT_FOUND,
        `No questions found for "${rawTopicTag}". Generate questions for this topic first.`
      );
    }

    const selected = selectAssessmentQuestions(questions, { level, count: questionCount });

    if (selected.length < 5) {
      return fail(
        Errors.NOT_FOUND,
        "Not enough validated questions to run an assessment for this topic."
      );
    }

    const sessionRef = db.collection(`users/${uid}/examSessions`).doc();
    await sessionRef.set({
      courseId,
      topicTag: rawTopicTag,
      topicTagNormalized: normalizedTopicTag,
      level,
      status: "ACTIVE",
      mode: "DIAGNOSTIC",
      questionIds: selected.map((question) => question.id),
      questionCount: selected.length,
      answeredCount: 0,
      correctCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return ok({
      sessionId: sessionRef.id,
      topicTag: rawTopicTag,
      level,
      levelLabel: levelProfile.label,
      targetTimeSec: levelProfile.targetTimeSec,
      questions: selected.map((question) => ({
        id: question.id,
        stem: question.stem,
        options: question.options,
        difficulty: question.difficulty || 3,
        topicTags: Array.isArray(question.topicTags) ? question.topicTags : [],
      })),
    });
  } catch (error) {
    return safeError(error, "assessment session start");
  }
});
