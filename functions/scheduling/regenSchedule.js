/**
 * @module scheduling/regenSchedule
 * @description Callable function that clears non-completed tasks for a course
 * so that `generateSchedule` can be called again with a clean slate.
 *
 * Completed (`DONE`) tasks are preserved by default.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchDelete } = require("../lib/firestore");

exports.regenSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "regenSchedule", RATE_LIMITS.regenSchedule);

    const { courseId, keepCompleted = true } = data;

    try {
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .get();

      const toDelete = tasksSnap.docs
        .filter((doc) => !(keepCompleted && doc.data().status === "DONE"))
        .map((doc) => doc.ref);

      const deletedCount = await batchDelete(toDelete);

      console.log(`Deleted ${deletedCount} tasks for course ${courseId}. Ready for re-generation.`);

      return {
        success: true,
        data: { deletedCount, message: "Old tasks cleared. Call generateSchedule to create new plan." },
      };
    } catch (error) {
      return safeError(error, "schedule regeneration");
    }
  });
