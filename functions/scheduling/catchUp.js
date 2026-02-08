/**
 * Callable/Scheduled: Catch-up logic for missed tasks.
 * Collects overdue TODO tasks and redistributes into future buffer slots.
 */
exports.catchUp = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { courseId } = data;

    if (!courseId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "courseId is required"
      );
    }

    try {
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
          data: { redistributedCount: 0, message: "No overdue tasks" },
        };
      }

      // Redistribute overdue tasks across the next 5 days
      const batch = db.batch();
      const overdueTasks = overdueSnap.docs;

      overdueTasks.forEach((doc, i) => {
        const dayOffset = Math.floor(i / Math.ceil(overdueTasks.length / 5)) + 1;
        const newDate = new Date(today.getTime() + dayOffset * 86400000);

        batch.update(doc.ref, {
          dueDate: admin.firestore.Timestamp.fromDate(newDate),
          priority: 1, // Mark as high priority (catch-up)
        });
      });

      await batch.commit();

      return {
        success: true,
        data: {
          redistributedCount: overdueTasks.length,
          message: `Redistributed ${overdueTasks.length} overdue tasks across next 5 days`,
        },
      };
    } catch (error) {
      console.error("catchUp error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });