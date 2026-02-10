/**
 * @module scheduling/generateSchedule
 * @description Callable function that builds a personalised study schedule for
 * a course.
 *
 * Algorithm overview:
 *  A. Build work units (STUDY + QUESTIONS + REVIEW) from analysed sections.
 *  B. Sum total workload in minutes.
 *  C. Compute daily capacity from availability config + catch-up buffer.
 *  D. Feasibility check — if load > capacity, return suggestions.
 *  E. Place tasks using a balanced-fill heuristic (hardest sections first).
 *  F. Place review tasks at spaced-repetition offsets from their study day.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchSet } = require("../lib/firestore");
const {
  MS_PER_DAY,
  REVISION_POLICIES,
  VALID_REVISION_POLICIES,
  DEFAULT_MINUTES_PER_DAY,
  MIN_DAILY_MINUTES,
  MAX_DAILY_MINUTES,
  MAX_SCHEDULE_DAYS,
  DEFAULT_STUDY_PERIOD_DAYS,
} = require("../lib/constants");
const { clampInt, truncate, toISODate, weekdayName } = require("../lib/utils");

exports.generateSchedule = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "generateSchedule", RATE_LIMITS.generateSchedule);

    try {
      const { courseId, availability, revisionPolicy } = data;

      // ── Fetch course ──────────────────────────────────────────────────
      const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
      if (!courseDoc.exists) {
        return { success: false, error: { code: "NOT_FOUND", message: "Course not found." } };
      }
      const course = courseDoc.data();
      const examDate = course.examDate?.toDate();

      // ── Fetch analysed sections ───────────────────────────────────────
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("courseId", "==", courseId)
        .where("aiStatus", "==", "ANALYZED")
        .orderBy("orderIndex")
        .get();

      if (sectionsSnap.empty) {
        return {
          success: false,
          error: { code: "NO_SECTIONS", message: "No analyzed sections found. Upload and process files first." },
        };
      }

      const sections = sectionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ── Step A: build work units ──────────────────────────────────────
      const policy = VALID_REVISION_POLICIES.has(revisionPolicy) ? revisionPolicy : "standard";
      const defaultMinutes = clampInt(availability?.defaultMinutesPerDay || DEFAULT_MINUTES_PER_DAY, MIN_DAILY_MINUTES, MAX_DAILY_MINUTES);
      const tasks = [];

      for (const section of sections) {
        const estMinutes = clampInt(section.estMinutes || 15, 5, 240);
        const difficulty = clampInt(section.difficulty || 3, 1, 5);
        const title = truncate(section.title, 200);
        const topicTags = (section.topicTags || []).slice(0, 10);

        // STUDY task
        tasks.push({
          courseId, type: "STUDY", title: `Study: ${title}`,
          sectionIds: [section.id], topicTags, estMinutes, difficulty,
          status: "TODO", isPinned: false, priority: 0,
        });

        // QUESTIONS task (35 % of study time, minimum 8 min)
        tasks.push({
          courseId, type: "QUESTIONS", title: `Questions: ${title}`,
          sectionIds: [section.id], topicTags,
          estMinutes: Math.max(8, Math.round(estMinutes * 0.35)),
          difficulty, status: "TODO", isPinned: false, priority: 0,
        });

        // REVIEW tasks from revision policy
        for (const review of REVISION_POLICIES[policy]) {
          tasks.push({
            courseId, type: "REVIEW", title: `Review: ${title}`,
            sectionIds: [section.id], topicTags,
            estMinutes: review.minutes, difficulty,
            status: "TODO", isPinned: false, priority: 0,
            _dayOffset: review.dayOffset,
          });
        }
      }

      // ── Step B: total load ────────────────────────────────────────────
      const totalMinutes = tasks.reduce((sum, t) => sum + t.estMinutes, 0);

      // ── Step C: daily capacity ────────────────────────────────────────
      const today = new Date();
      const endDate = examDate || new Date(today.getTime() + DEFAULT_STUDY_PERIOD_DAYS * MS_PER_DAY);
      const excludedDates = new Set((availability?.excludedDates || []).slice(0, 365));
      const catchUpBuffer = clampInt(availability?.catchUpBufferPercent || 15, 0, 50) / 100;

      const days = [];
      let cursor = new Date(today);
      let dayCount = 0;

      while (cursor <= endDate && dayCount < MAX_SCHEDULE_DAYS) {
        const iso = toISODate(cursor);
        const dayName = weekdayName(cursor);

        if (!excludedDates.has(iso)) {
          const override = availability?.perDayOverrides?.[dayName];
          const capacity = override != null ? clampInt(override, 0, MAX_DAILY_MINUTES) : defaultMinutes;
          const usable = Math.floor(capacity * (1 - catchUpBuffer));
          days.push({ date: new Date(cursor), usableCapacity: usable, remaining: usable });
        }

        cursor = new Date(cursor.getTime() + MS_PER_DAY);
        dayCount++;
      }

      // ── Step D: feasibility check ─────────────────────────────────────
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

      // ── Step E: place study + question tasks (balanced fill) ──────────
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

      // ── Step F: place review tasks at offset from their study day ─────
      for (const task of reviewTasks) {
        const studyTask = placedTasks.find(
          (t) => t.type === "STUDY" && t.sectionIds[0] === task.sectionIds[0]
        );
        if (!studyTask) continue;

        const studyDate = studyTask.dueDate.toDate();
        const studyDayIdx = days.findIndex((d) => d.date.getTime() === studyDate.getTime());
        if (studyDayIdx === -1) continue;

        const targetDayIndex = Math.min(studyDayIdx + (task._dayOffset || 1), days.length - 1);
        const { _dayOffset, ...cleanTask } = task;

        placedTasks.push({
          ...cleanTask,
          dueDate: admin.firestore.Timestamp.fromDate(days[targetDayIndex].date),
          orderIndex: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // ── Persist ───────────────────────────────────────────────────────
      await batchSet(
        placedTasks.map((task) => ({
          ref: db.collection(`users/${uid}/tasks`).doc(),
          data: task,
        }))
      );

      return {
        success: true,
        data: { feasible: true, taskCount: placedTasks.length, totalDays: days.length },
      };
    } catch (error) {
      return safeError(error, "schedule generation");
    }
  });
