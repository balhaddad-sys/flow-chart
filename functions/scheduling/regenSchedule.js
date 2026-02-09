const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");

const db = admin.firestore();

/**
 * Callable: Regenerate schedule keeping completed tasks.
 * Deletes non-completed tasks and re-runs scheduling algorithm.
 */
exports.regenSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "regenSchedule", RATE_LIMITS.regenSchedule);

    const { courseId, keepCompleted = true } = data;

    try {
      // Delete non-completed tasks
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .get();

      const BATCH_LIMIT = 500;
      let deletedCount = 0;
      const toDelete = [];

      for (const doc of tasksSnap.docs) {
        const task = doc.data();
        if (keepCompleted && task.status === "DONE") continue;
        toDelete.push(doc.ref);
      }

      for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
        const chunk = toDelete.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
        deletedCount += chunk.length;
      }

      console.log(
        `Deleted ${deletedCount} tasks for course ${courseId}. Ready for re-generation.`
      );

      return {
        success: true,
        data: {
          deletedCount,
          message: "Old tasks cleared. Call generateSchedule to create new plan.",
        },
      };
    } catch (error) {
      return safeError(error, "schedule regeneration");
    }
  });
