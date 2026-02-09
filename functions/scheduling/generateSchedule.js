const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");

const db = admin.firestore();

/**
 * Callable: Generate a study schedule for a course.
 * Build work units -> estimate load -> compute capacity -> feasibility check -> place tasks
 */
exports.generateSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "generateSchedule", RATE_LIMITS.generateSchedule);

    try {
      const { courseId, availability, revisionPolicy } = data;

      // Fetch course
      const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
      if (!courseDoc.exists) {
        return { success: false, error: { code: "NOT_FOUND", message: "Course not found." } };
      }
      const course = courseDoc.data();
      const examDate = course.examDate?.toDate();

      // Fetch all analyzed sections for this course
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("courseId", "==", courseId)
        .where("aiStatus", "==", "ANALYZED")
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
      const validPolicies = new Set(["off", "light", "standard", "aggressive"]);
      const policy = validPolicies.has(revisionPolicy) ? revisionPolicy : "standard";
      const defaultMinutes = Math.min(480, Math.max(30, availability?.defaultMinutesPerDay || 120));

      for (const section of sections) {
        const estMinutes = Math.min(240, Math.max(5, section.estMinutes || 15));
        const difficulty = Math.min(5, Math.max(1, section.difficulty || 3));

        // STUDY task
        tasks.push({
          courseId,
          type: "STUDY",
          title: `Study: ${String(section.title).slice(0, 200)}`,
          sectionIds: [section.id],
          topicTags: (section.topicTags || []).slice(0, 10),
          estMinutes,
          difficulty,
          status: "TODO",
          isPinned: false,
          priority: 0,
        });

        // QUESTIONS task
        tasks.push({
          courseId,
          type: "QUESTIONS",
          title: `Questions: ${String(section.title).slice(0, 200)}`,
          sectionIds: [section.id],
          topicTags: (section.topicTags || []).slice(0, 10),
          estMinutes: Math.max(8, Math.round(estMinutes * 0.35)),
          difficulty,
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
            title: `Review: ${String(section.title).slice(0, 200)}`,
            sectionIds: [section.id],
            topicTags: (section.topicTags || []).slice(0, 10),
            estMinutes: review.minutes,
            difficulty,
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
      const excludedDates = new Set(
        (availability?.excludedDates || []).slice(0, 365)
      );
      const catchUpBuffer = Math.min(50, Math.max(0, availability?.catchUpBufferPercent || 15)) / 100;

      const days = [];
      let cursor = new Date(today);
      const maxDays = 365;
      let dayCount = 0;
      while (cursor <= endDate && dayCount < maxDays) {
        const iso = cursor.toISOString().split("T")[0];
        const dayName = cursor.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

        if (!excludedDates.has(iso)) {
          const override = availability?.perDayOverrides?.[dayName];
          const capacity = override != null ? Math.min(480, Math.max(0, override)) : defaultMinutes;
          days.push({
            date: new Date(cursor),
            usableCapacity: Math.floor(capacity * (1 - catchUpBuffer)),
            remaining: Math.floor(capacity * (1 - catchUpBuffer)),
          });
        }

        cursor = new Date(cursor.getTime() + 86400000);
        dayCount++;
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
      const studyTasks = tasks.filter((t) => t.type === "STUDY" || t.type === "QUESTIONS");
      const reviewTasks = tasks.filter((t) => t.type === "REVIEW");

      studyTasks.sort((a, b) => b.difficulty - a.difficulty);

      let dayIndex = 0;
      let orderIndex = 0;
      const placedTasks = [];

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

      // Place review tasks at offset from their study task's day
      for (const task of reviewTasks) {
        const studyTask = placedTasks.find(
          (t) => t.type === "STUDY" && t.sectionIds[0] === task.sectionIds[0]
        );
        if (!studyTask) continue;

        const studyDate = studyTask.dueDate.toDate();
        const studyDayIdx = days.findIndex(
          (d) => d.date.getTime() === studyDate.getTime()
        );
        if (studyDayIdx === -1) continue;

        const targetDayIndex = Math.min(
          studyDayIdx + (task._dayOffset || 1),
          days.length - 1
        );

        const { _dayOffset, ...cleanTask } = task;
        placedTasks.push({
          ...cleanTask,
          dueDate: admin.firestore.Timestamp.fromDate(days[targetDayIndex].date),
          orderIndex: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Batch write tasks (respecting 500-doc Firestore limit)
      const BATCH_LIMIT = 500;
      for (let i = 0; i < placedTasks.length; i += BATCH_LIMIT) {
        const chunk = placedTasks.slice(i, i + BATCH_LIMIT);
        const batch = db.batch();
        for (const task of chunk) {
          const ref = db.collection(`users/${uid}/tasks`).doc();
          batch.set(ref, task);
        }
        await batch.commit();
      }

      return {
        success: true,
        data: {
          feasible: true,
          taskCount: placedTasks.length,
          totalDays: days.length,
        },
      };
    } catch (error) {
      return safeError(error, "schedule generation");
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
