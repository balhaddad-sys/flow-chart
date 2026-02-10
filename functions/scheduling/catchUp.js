/**
 * @module scheduling/catchUp
 * @description Callable function that redistributes overdue TODO tasks evenly
 * across the next several days.
 *
 * Overdue tasks (dueDate < today, status = TODO) are spread over a fixed
 * window defined by `CATCH_UP_SPAN_DAYS` and given elevated priority so they
 * appear at the top of the student's daily plan.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchUpdate } = require("../lib/firestore");
const { MS_PER_DAY, CATCH_UP_SPAN_DAYS } = require("../lib/constants");

exports.catchUp = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "catchUp", RATE_LIMITS.catchUp);

    try {
      const { courseId } = data;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Find overdue TODO tasks
      const overdueSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .where("status", "==", "TODO")
        .where("dueDate", "<", admin.firestore.Timestamp.fromDate(today))
        .get();

      if (overdueSnap.empty) {
        return { success: true, data: { redistributedCount: 0, message: "No overdue tasks." } };
      }

      const overdueDocs = overdueSnap.docs;

      // Distribute evenly across the catch-up window
      const updates = overdueDocs.map((doc, idx) => {
        const dayOffset = Math.floor(idx / Math.ceil(overdueDocs.length / CATCH_UP_SPAN_DAYS)) + 1;
        const newDate = new Date(today.getTime() + dayOffset * MS_PER_DAY);

        return {
          ref: doc.ref,
          data: {
            dueDate: admin.firestore.Timestamp.fromDate(newDate),
            priority: 1,
          },
        };
      });

      await batchUpdate(updates);

      return {
        success: true,
        data: {
          redistributedCount: overdueDocs.length,
          message: `Redistributed ${overdueDocs.length} overdue tasks across next ${CATCH_UP_SPAN_DAYS} days.`,
        },
      };
    } catch (error) {
      return safeError(error, "catch-up scheduling");
    }
  });
