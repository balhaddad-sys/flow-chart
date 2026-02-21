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

// Define the secret so the function can access it (used by getTutorResponse)
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

exports.submitAttempt = functions
  .runWith({
    timeoutSeconds: 60,
    secrets: [anthropicApiKey],
  })
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
      let question = null;
      let questionRef = null;
      const questionDoc = await db.doc(`users/${uid}/questions/${questionId}`).get();

      if (questionDoc.exists) {
        question = questionDoc.data();
        questionRef = questionDoc.ref;
      } else if (questionId.startsWith("exambank_")) {
        // Exam bank questions may only exist in the embedded array.
        // ID format: exambank_{EXAM_TYPE}_{13-digit-timestamp}_{index}
        const idMatch = questionId.match(/^exambank_(.+)_(\d{13,})_(\d+)$/);
        const examType = idMatch ? idMatch[1] : null;
        log.info("Exam bank question lookup", { uid, questionId, examType });
        if (examType) {
          const bankSnap = await db.doc(`users/${uid}/examBank/${examType}`).get();
          if (bankSnap.exists) {
            const bankData = bankSnap.data();
            const match = (bankData.questions || []).find((q) => q.id === questionId);
            if (match) {
              question = { ...match, courseId: examType };
              // Promote to individual doc so future attempts are fast
              questionRef = db.doc(`users/${uid}/questions/${questionId}`);
              await questionRef.set({ ...question, createdAt: admin.firestore.FieldValue.serverTimestamp() });
              log.info("Exam bank question promoted", { uid, questionId, examType });
            } else {
              log.warn("Question not found in exam bank array", { uid, questionId, examType, bankSize: (bankData.questions || []).length });
            }
          } else {
            log.warn("Exam bank doc not found", { uid, questionId, examType });
          }
        } else {
          log.warn("Could not parse exam type from question ID", { uid, questionId });
        }
      }

      if (!question) return fail(Errors.NOT_FOUND, "Question not found.");

      const correct = answerIndex === question.correctIndex;

      // ── IDEMPOTENCY: Use deterministic ID to prevent duplicate attempts ──
      // Combines questionId + timestamp (rounded to 1s) to detect retries
      const idempotencyKey = `${questionId}_${answerIndex}_${Math.floor(Date.now() / 1000)}`;
      const attemptRef = db.collection(`users/${uid}/attempts`).doc(idempotencyKey);

      // Check if this attempt already exists (function retry)
      const existingAttempt = await attemptRef.get();
      if (existingAttempt.exists) {
        log.info("Duplicate attempt detected, returning cached result", { uid, questionId });
        const cached = existingAttempt.data();
        return ok({
          correct: cached.correct,
          attemptId: attemptRef.id,
          tutorResponse: cached.tutorResponseCached,
        });
      }

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

      // ── Update question stats atomically ──────────────────────────────
      // Use Firestore increment to prevent race conditions with concurrent attempts
      if (questionRef) {
        await questionRef.update({
          "stats.timesAnswered": admin.firestore.FieldValue.increment(1),
          "stats.timesCorrect": admin.firestore.FieldValue.increment(correct ? 1 : 0),
        });
      }

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
