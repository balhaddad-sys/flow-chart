/**
 * @module analytics/submitAttempt
 * @description Callable function that records a quiz answer, updates question
 * stats, and generates an AI tutor explanation for incorrect answers.
 *
 * Uses the {@link module:lib/serialize} module to normalise tutor responses.
 *
 * @param {Object} data
 * @param {string} data.questionId
 * @param {number} data.answerIndex  - 0-based index into the question's options.
 * @param {number} data.timeSpentSec - Seconds the student spent on the question.
 * @param {number} [data.confidence] - 1–5 self-reported confidence (optional).
 * @returns {{ success: true, data: { correct: boolean, attemptId: string, tutorResponse: object|null } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { normaliseTutorResponse } = require("../lib/serialize");
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
      if (!questionDoc.exists) return fail(Errors.NOT_FOUND, "Question not found.");

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
          tutorResponse = normaliseTutorResponse(result.data);
          await attemptRef.update({ tutorResponseCached: tutorResponse });
        } else {
          log.warn("Tutor response generation failed", { uid, questionId, error: result.error });
        }
      }

      log.info("Attempt submitted", { uid, questionId, correct });

      return ok({ correct, attemptId: attemptRef.id, tutorResponse });
    } catch (error) {
      return safeError(error, "attempt submission");
    }
  });
