/**
 * @module analytics/flagQuestion
 * @description Callable that lets a student flag a question for quality review.
 *
 * Flags are written to `users/{uid}/flags/{flagId}` and the question's
 * `flagCount` is incremented atomically.  The self-tuning cost engine and
 * prompt analytics pipelines can read the `flags` sub-collection to improve
 * future AI prompts.
 *
 * @param {Object} data
 * @param {string} data.questionId   - ID of the question being flagged.
 * @param {string} data.reason       - One of FLAG_REASONS (see constants).
 * @param {string} [data.freeText]   - Optional free-text note (max 500 chars).
 * @returns {{ success: true, data: { flagId: string } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { FLAG_REASONS } = require("../lib/constants");

exports.flagQuestion = functions
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "questionId", maxLen: 128 }]);
    await checkRateLimit(uid, "flagQuestion", RATE_LIMITS.submitAttempt);

    const { questionId, reason, freeText } = data;

    if (!FLAG_REASONS.includes(reason)) {
      return fail(Errors.INVALID_ARGUMENT, `reason must be one of: ${FLAG_REASONS.join(", ")}`);
    }
    if (freeText && freeText.length > 500) {
      return fail(Errors.INVALID_ARGUMENT, "freeText exceeds 500 characters.");
    }

    try {
      const questionRef = db.doc(`users/${uid}/questions/${questionId}`);
      const questionSnap = await questionRef.get();
      if (!questionSnap.exists) return fail(Errors.NOT_FOUND, "Question not found.");

      const flagRef = db.collection(`users/${uid}/flags`).doc();

      await flagRef.set({
        questionId,
        courseId: questionSnap.data().courseId || null,
        reason,
        freeText: freeText || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Increment flag counter on the question atomically
      await questionRef.set(
        { flagCount: admin.firestore.FieldValue.increment(1) },
        { merge: true }
      );

      log.info("Question flagged", { uid, questionId, reason });
      return ok({ flagId: flagRef.id });
    } catch (error) {
      return safeError(error, "flag question");
    }
  });
