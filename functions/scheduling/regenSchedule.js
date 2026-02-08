const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Callable: Regenerate schedule keeping completed tasks.
 * Deletes non-completed tasks and re-runs scheduling algorithm.
 */
exports.regenSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { courseId, keepCompleted = true } = data;

    if (!courseId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "courseId is required"
      );
    }

    try {
      // Delete non-completed tasks
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", isEqualTo: courseId)
        .get();

      const batch = db.batch();
      let deletedCount = 0;

      for (const doc of tasksSnap.docs) {
        const task = doc.data();
        if (keepCompleted && task.status === "DONE") continue;
        batch.delete(doc.ref);
        deletedCount++;
      }

      await batch.commit();

      console.log(
        `Deleted ${deletedCount} tasks for course ${courseId}. Ready for re-generation.`
      );

      // The caller should now call generateSchedule to create new tasks
      return {
        success: true,
        data: {
          deletedCount,
          message: "Old tasks cleared. Call generateSchedule to create new plan.",
        },
      };
    } catch (error) {
      console.error("regenSchedule error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });
