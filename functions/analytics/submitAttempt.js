/**
 * @module analytics/submitAttempt
 * @description Callable function that records a student's answer to a quiz
 * question, updates aggregate question stats, and — when the answer is
 * incorrect — generates an AI tutor explanation via Claude Opus.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { getTutorResponse } = require("../ai/aiClient");
const { TUTOR_SYSTEM, tutorUserPrompt } = require("../ai/prompts");

exports.submitAttempt = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "questionId", maxLen: 128 }]);
    const answerIndex = requireInt(data, "answerIndex", 0, 7);
    const timeSpentSec = requireInt(data, "timeSpentSec", 0, 3600);
    const confidence = data.confidence != null ? requireInt(data, "confidence", 1, 5) : null;

    await checkRateLimit(uid, "submitAttempt", RATE_LIMITS.submitAttempt);

    try {
      const { questionId } = data;

      // ── Fetch question ──────────────────────────────────────────────────
      const questionDoc = await db.doc(`users/${uid}/questions/${questionId}`).get();
      if (!questionDoc.exists) {
        return { success: false, error: { code: "NOT_FOUND", message: "Question not found." } };
      }
      const question = questionDoc.data();
      const correct = answerIndex === question.correctIndex;

      // ── Create attempt record ───────────────────────────────────────────
      const attemptRef = db.collection(`users/${uid}/attempts`).doc();
      await attemptRef.set({
        questionId,
        courseId: question.courseId,
        taskId: null,
        answeredIndex: answerIndex,
        correct,
        timeSpentSec,
        confidence,
        tutorResponseCached: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Update question stats ───────────────────────────────────────────
      const stats = question.stats || { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 };
      const newTimesAnswered = stats.timesAnswered + 1;
      const newTimesCorrect = stats.timesCorrect + (correct ? 1 : 0);
      const newAvgTime = (stats.avgTimeSec * stats.timesAnswered + timeSpentSec) / newTimesAnswered;

      await questionDoc.ref.update({
        "stats.timesAnswered": newTimesAnswered,
        "stats.timesCorrect": newTimesCorrect,
        "stats.avgTimeSec": Math.round(newAvgTime * 100) / 100,
      });

      // ── AI tutor response (incorrect answers only) ─────────────────────
      let tutorResponse = null;
      if (!correct) {
        const result = await getTutorResponse(
          TUTOR_SYSTEM,
          tutorUserPrompt({
            questionJSON: question,
            studentAnswerIndex: answerIndex,
            correctIndex: question.correctIndex,
          })
        );

        if (result.success) {
          tutorResponse = result.data;
          await attemptRef.update({ tutorResponseCached: tutorResponse });
        }
      }

      return { success: true, data: { correct, attemptId: attemptRef.id, tutorResponse } };
    } catch (error) {
      return safeError(error, "attempt submission");
    }
  });
