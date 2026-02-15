/**
 * @module assessment/submitAssessmentAnswer
 * @description Callable function that records a single answer inside an active
 * assessment session and updates aggregate counters.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");

exports.submitAssessmentAnswer = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [
    { field: "sessionId", maxLen: 128 },
    { field: "questionId", maxLen: 128 },
  ]);
  const answerIndex = requireInt(data, "answerIndex", 0, 7);
  const timeSpentSec = requireInt(data, "timeSpentSec", 0, 3600);
  const confidence = data.confidence != null ? requireInt(data, "confidence", 1, 5) : null;

  await checkRateLimit(uid, "submitAssessmentAnswer", RATE_LIMITS.submitAssessmentAnswer);

  try {
    const { sessionId, questionId } = data;
    const sessionRef = db.doc(`users/${uid}/examSessions/${sessionId}`);
    const responseRef = sessionRef.collection("responses").doc(questionId);
    const questionRef = db.doc(`users/${uid}/questions/${questionId}`);
    const attemptRef = db.doc(`users/${uid}/attempts/assessment_${sessionId}_${questionId}`);

    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) return fail(Errors.NOT_FOUND, "Assessment session not found.");
    const session = sessionDoc.data();

    if (session.status !== "ACTIVE") {
      return fail(Errors.INVALID_ARGUMENT, "This assessment session is not active.");
    }
    if (!Array.isArray(session.questionIds) || !session.questionIds.includes(questionId)) {
      return fail(Errors.PERMISSION_DENIED, "Question is not part of this assessment session.");
    }

    const existingResponse = await responseRef.get();
    if (existingResponse.exists) {
      const cached = existingResponse.data();
      return ok({
        correct: cached.correct === true,
        correctIndex: cached.correctIndex,
        explanation: cached.explanation || null,
        answeredCount: session.answeredCount || 0,
        totalQuestions: session.questionCount || session.questionIds.length,
        isComplete: (session.answeredCount || 0) >= (session.questionCount || session.questionIds.length),
      });
    }

    const questionDoc = await questionRef.get();
    if (!questionDoc.exists) return fail(Errors.NOT_FOUND, "Question not found.");
    const question = questionDoc.data();

    if (!Array.isArray(question.options) || answerIndex >= question.options.length) {
      return fail(Errors.INVALID_ARGUMENT, "Selected option is out of range for this question.");
    }

    const correct = answerIndex === question.correctIndex;
    const nextAnsweredCount = (session.answeredCount || 0) + 1;
    const totalQuestions = session.questionCount || session.questionIds.length;
    const nextCorrectCount = (session.correctCount || 0) + (correct ? 1 : 0);

    const batch = db.batch();
    batch.set(responseRef, {
      questionId,
      answerIndex,
      correct,
      correctIndex: question.correctIndex,
      explanation: question.explanation || null,
      timeSpentSec,
      confidence,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(questionRef, {
      "stats.timesAnswered": admin.firestore.FieldValue.increment(1),
      "stats.timesCorrect": admin.firestore.FieldValue.increment(correct ? 1 : 0),
    });
    batch.set(attemptRef, {
      questionId,
      courseId: session.courseId || question.courseId,
      taskId: null,
      answeredIndex: answerIndex,
      correct,
      timeSpentSec,
      confidence,
      tutorResponseCached: null,
      examSessionId: sessionId,
      assessmentTopic: session.topicTag || null,
      assessmentLevel: session.level || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(sessionRef, {
      answeredCount: nextAnsweredCount,
      correctCount: nextCorrectCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    log.info("Assessment answer submitted", {
      uid,
      sessionId,
      questionId,
      correct,
      answeredCount: nextAnsweredCount,
      totalQuestions,
    });

    return ok({
      correct,
      correctIndex: question.correctIndex,
      explanation: question.explanation || null,
      answeredCount: nextAnsweredCount,
      totalQuestions,
      isComplete: nextAnsweredCount >= totalQuestions,
    });
  } catch (error) {
    return safeError(error, "assessment answer submission");
  }
});
