const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");

const db = admin.firestore();

/**
 * Callable: Catch-up logic for missed tasks.
 * Collects overdue TODO tasks and redistributes into future buffer slots.
 */
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

      // Find overdue tasks (dueDate < today, status = TODO)
      const overdueSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .where("status", "==", "TODO")
        .where("dueDate", "<", admin.firestore.Timestamp.fromDate(today))
        .get();

      if (overdueSnap.empty) {
        return {
          success: true,
          data: { redistributedCount: 0, message: "No overdue tasks." },
        };
      }

      const BATCH_LIMIT = 500;
      const overdueTasks = overdueSnap.docs;
      const redistSpan = 5;

      for (let i = 0; i < overdueTasks.length; i += BATCH_LIMIT) {
        const chunk = overdueTasks.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();

        chunk.forEach((doc, idx) => {
          const globalIdx = i + idx;
          const dayOffset = Math.floor(globalIdx / Math.ceil(overdueTasks.length / redistSpan)) + 1;
          const newDate = new Date(today.getTime() + dayOffset * 86400000);

          batch.update(doc.ref, {
            dueDate: admin.firestore.Timestamp.fromDate(newDate),
            priority: 1,
          });
        });

        await batch.commit();
      }

      return {
        success: true,
        data: {
          redistributedCount: overdueTasks.length,
          message: `Redistributed ${overdueTasks.length} overdue tasks across next ${redistSpan} days.`,
        },
      };
    } catch (error) {
      return safeError(error, "catch-up scheduling");
    }
  });
