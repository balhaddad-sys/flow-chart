const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Callable: Generate a study schedule for a course.
 * Implements the scheduling algorithm from the spec:
 * Build work units → estimate load → compute capacity → feasibility check → place tasks
 */
exports.generateSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { courseId, availability, revisionPolicy } = data;

    if (!courseId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "courseId is required"
      );
    }

    try {
      // Fetch course
      const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
      if (!courseDoc.exists) {
        return { success: false, error: { code: "NOT_FOUND", message: "Course not found" } };
      }
      const course = courseDoc.data();
      const examDate = course.examDate?.toDate();

      // Fetch all analyzed sections for this course
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("courseId", isEqualTo: courseId)
        .where("aiStatus", isEqualTo: "ANALYZED")
        .orderBy("orderIndex")
        .get();

      if (sectionsSnap.empty) {
        return {
          success: false,
          error: {
            code: "NO_SECTIONS",
            message: "No analyzed sections found. Upload and process files first.",
          },
        };
      }

      const sections = sectionsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Step A: Build work units
      const tasks = [];
      const policy = revisionPolicy || "standard";
      const defaultMinutes = availability?.defaultMinutesPerDay || 120;

      for (const section of sections) {
        // STUDY task
        tasks.push({
          courseId,
          type: "STUDY",
          title: `Study: ${section.title}`,
          sectionIds: [section.id],
          topicTags: section.topicTags || [],
          estMinutes: section.estMinutes || 15,
          difficulty: section.difficulty || 3,
          status: "TODO",
          isPinned: false,
          priority: 0,
        });

        // QUESTIONS task
        tasks.push({
          courseId,
          type: "QUESTIONS",
          title: `Questions: ${section.title}`,
          sectionIds: [section.id],
          topicTags: section.topicTags || [],
          estMinutes: Math.max(8, Math.round((section.estMinutes || 15) * 0.35)),
          difficulty: section.difficulty || 3,
          status: "TODO",
          isPinned: false,
          priority: 0,
        });

        // REVIEW tasks based on revision policy
        const reviewConfigs = getReviewConfig(policy);
        for (const review of reviewConfigs) {
          tasks.push({
            courseId,
            type: "REVIEW",
            title: `Review: ${section.title}`,
            sectionIds: [section.id],
            topicTags: section.topicTags || [],
            estMinutes: review.minutes,
            difficulty: section.difficulty || 3,
            status: "TODO",
            isPinned: false,
            priority: 0,
            _dayOffset: review.dayOffset,
          });
        }
      }

      // Step B: Total load
      const totalMinutes = tasks.reduce((sum, t) => sum + t.estMinutes, 0);

      // Step C: Compute daily capacity
      const today = new Date();
      const endDate = examDate || new Date(today.getTime() + 30 * 86400000);
      const excludedDates = new Set(availability?.excludedDates || []);
      const catchUpBuffer = (availability?.catchUpBufferPercent || 15) / 100;

      const days = [];
      let cursor = new Date(today);
      while (cursor <= endDate) {
        const iso = cursor.toISOString().split("T")[0];
        const dayName = cursor.toLocaleDateString("en-US", { weekday: "lowercase" });

        if (!excludedDates.has(iso)) {
          const override = availability?.perDayOverrides?.[dayName];
          const capacity = override != null ? override : defaultMinutes;
          days.push({
            date: new Date(cursor),
            usableCapacity: Math.floor(capacity * (1 - catchUpBuffer)),
            remaining: Math.floor(capacity * (1 - catchUpBuffer)),
          });
        }

        cursor = new Date(cursor.getTime() + 86400000);
      }

      // Step D: Feasibility check
      const totalUsable = days.reduce((sum, d) => sum + d.usableCapacity, 0);
      if (totalMinutes > totalUsable) {
        return {
          success: true,
          data: {
            feasible: false,
            deficit: totalMinutes - totalUsable,
            taskCount: tasks.length,
            suggestions: [
              "Increase daily study time",
              "Reduce revision intensity",
              "Extend your study period",
            ],
          },
        };
      }

      // Step E: Place tasks (balanced fill)
      // Sort: difficulty desc, then by order
      const studyTasks = tasks.filter((t) => t.type === "STUDY" || t.type === "QUESTIONS");
      const reviewTasks = tasks.filter((t) => t.type === "REVIEW");

      // Sort study tasks by difficulty desc
      studyTasks.sort((a, b) => b.difficulty - a.difficulty);

      let dayIndex = 0;
      let orderIndex = 0;
      const placedTasks = [];

      // Place study + question tasks
      for (const task of studyTasks) {
        while (dayIndex < days.length && days[dayIndex].remaining < task.estMinutes) {
          dayIndex++;
          orderIndex = 0;
        }
        if (dayIndex >= days.length) break;

        placedTasks.push({
          ...task,
          dueDate: admin.firestore.Timestamp.fromDate(days[dayIndex].date),
          orderIndex: orderIndex++,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        days[dayIndex].remaining -= task.estMinutes;
      }

      // Place review tasks at offset from their study task
      for (const task of reviewTasks) {
        const studyDayIndex = placedTasks.findIndex(
          (t) =>
            t.type === "STUDY" &&
            t.sectionIds[0] === task.sectionIds[0]
        );
        if (studyDayIndex === -1) continue;

        const targetDayIndex = Math.min(
          studyDayIndex + (task._dayOffset || 1),
          days.length - 1
        );

        // Clean up internal field
        const { _dayOffset, ...cleanTask } = task;
        placedTasks.push({
          ...cleanTask,
          dueDate: admin.firestore.Timestamp.fromDate(
            days[Math.min(targetDayIndex, days.length - 1)].date
          ),
          orderIndex: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Batch write tasks
      const batch = db.batch();
      for (const task of placedTasks) {
        const ref = db.collection(`users/${uid}/tasks`).doc();
        batch.set(ref, task);
      }
      await batch.commit();

      return {
        success: true,
        data: {
          feasible: true,
          taskCount: placedTasks.length,
          totalDays: days.length,
        },
      };
    } catch (error) {
      console.error("generateSchedule error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });

function getReviewConfig(policy) {
  switch (policy) {
    case "light":
      return [{ dayOffset: 3, minutes: 10 }];
    case "standard":
      return [
        { dayOffset: 1, minutes: 10 },
        { dayOffset: 3, minutes: 15 },
        { dayOffset: 7, minutes: 25 },
      ];
    case "aggressive":
      return [
        { dayOffset: 1, minutes: 15 },
        { dayOffset: 3, minutes: 20 },
        { dayOffset: 7, minutes: 30 },
        { dayOffset: 14, minutes: 20 },
      ];
    default:
      return [];
  }
}
