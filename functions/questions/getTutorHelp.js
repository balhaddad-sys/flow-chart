/**
 * @module questions/getTutorHelp
 * @description Callable function that returns the AI tutor explanation for
 * a given question attempt. Returns the cached response if available,
 * otherwise generates a new one via Claude.
 *
 * @param {Object} data
 * @param {string} data.questionId - The question that was answered.
 * @param {string} data.attemptId  - The student's attempt record.
 * @returns {{ success: true, data: { tutorResponse: object } }}
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { normaliseTutorResponse } = require("../lib/serialize");
const { getTutorResponse } = require("../ai/aiClient");
const { TUTOR_SYSTEM, tutorUserPrompt } = require("../ai/prompts");

exports.getTutorHelp = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "questionId", maxLen: 128 },
      { field: "attemptId", maxLen: 128 },
    ]);

    await checkRateLimit(uid, "getTutorHelp", RATE_LIMITS.getTutorHelp);

    try {
      const { questionId, attemptId } = data;

      // ── Fetch attempt ─────────────────────────────────────────────────
      const attemptDoc = await db.doc(`users/${uid}/attempts/${attemptId}`).get();
      if (!attemptDoc.exists) return fail(Errors.NOT_FOUND, "Attempt not found.");
      const attempt = attemptDoc.data();

      // ── Return cached response if available ───────────────────────────
      if (attempt.tutorResponseCached) {
        return ok({ tutorResponse: attempt.tutorResponseCached });
      }

      // ── Fetch question ────────────────────────────────────────────────
      const questionDoc = await db.doc(`users/${uid}/questions/${questionId}`).get();
      if (!questionDoc.exists) return fail(Errors.NOT_FOUND, "Question not found.");
      const question = questionDoc.data();

      // ── Generate tutor response via AI ────────────────────────────────
      const result = await getTutorResponse(
        TUTOR_SYSTEM,
        tutorUserPrompt({
          questionJSON: question,
          studentAnswerIndex: attempt.answeredIndex,
          correctIndex: question.correctIndex,
        })
      );

      if (!result.success) {
        log.warn("Tutor AI call failed", { uid, questionId, attemptId, error: result.error });
        return fail(Errors.AI_FAILED, "Could not generate tutor explanation. Please try again.");
      }

      const tutorResponse = normaliseTutorResponse(result.data);
      if (!tutorResponse) {
        log.warn("Tutor response normalisation failed", { uid, questionId, attemptId });
        return fail(Errors.AI_FAILED, "AI returned an invalid tutor response.");
      }

      // ── Cache on the attempt for future calls ─────────────────────────
      await attemptDoc.ref.update({ tutorResponseCached: tutorResponse });

      log.info("Tutor help generated", { uid, questionId, attemptId });

      return ok({ tutorResponse });
    } catch (error) {
      return safeError(error, "tutor help");
    }
  });
