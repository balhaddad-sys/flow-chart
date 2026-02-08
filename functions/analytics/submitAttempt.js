const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { getTutorResponse } = require("../ai/aiClient");
const { TUTOR_SYSTEM, tutorUserPrompt } = require("../ai/prompts");

const db = admin.firestore();

/**
 * Callable: Submit a question attempt.
 * Logs the attempt, updates question stats, and returns tutor response if wrong.
 */
exports.submitAttempt = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { questionId, answerIndex, timeSpentSec, confidence } = data;

    if (questionId == null || answerIndex == null || timeSpentSec == null) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "questionId, answerIndex, and timeSpentSec are required"
      );
    }

    try {
      // Fetch question
      const questionDoc = await db
        .doc(`users/${uid}/questions/${questionId}`)
        .get();
      if (!questionDoc.exists) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Question not found" },
        };
      }
      const question = questionDoc.data();
      const correct = answerIndex === question.correctIndex;

      // Create attempt record
      const attemptRef = db.collection(`users/${uid}/attempts`).doc();
      await attemptRef.set({
        questionId,
        courseId: question.courseId,
        taskId: null,
        answeredIndex: answerIndex,
        correct,
        timeSpentSec,
        confidence: confidence || null,
        tutorResponseCached: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update question stats
      const stats = question.stats || {
        timesAnswered: 0,
        timesCorrect: 0,
        avgTimeSec: 0,
      };
      const newTimesAnswered = stats.timesAnswered + 1;
      const newTimesCorrect = stats.timesCorrect + (correct ? 1 : 0);
      const newAvgTime =
        (stats.avgTimeSec * stats.timesAnswered + timeSpentSec) /
        newTimesAnswered;

      await questionDoc.ref.update({
        "stats.timesAnswered": newTimesAnswered,
        "stats.timesCorrect": newTimesCorrect,
        "stats.avgTimeSec": Math.round(newAvgTime * 100) / 100,
      });

      // Generate tutor response if wrong
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
          // Cache tutor response on attempt
          await attemptRef.update({
            tutorResponseCached: tutorResponse,
          });
        }
      }

      return {
        success: true,
        data: {
          correct,
          attemptId: attemptRef.id,
          tutorResponse,
        },
      };
    } catch (error) {
      console.error("submitAttempt error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });
