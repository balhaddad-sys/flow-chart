/**
 * @module scheduling/generateSchedule
 * @description Callable function that builds a personalised study schedule.
 *
 * Delegates all algorithmic work to the pure {@link module:scheduling/scheduler}
 * module and handles only Firestore I/O and Firebase envelope concerns here.
 *
 * @param {Object} data
 * @param {string} data.courseId - Target course.
 * @param {import('./scheduler').AvailabilityConfig} [data.availability]
 * @param {string} [data.revisionPolicy="standard"] - One of "off"|"light"|"standard"|"aggressive".
 * @returns {{ success: true, data: { feasible: boolean, taskCount: number, totalDays: number, deficit?: number, suggestions?: string[] } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchSet, batchDelete } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { MS_PER_DAY, MAX_SCHEDULE_DAYS } = require("../lib/constants");
const {
  buildAdaptiveContext,
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
  validateScheduleInputs,
  triageSections,
  mergeAdjacentThinSections,
  pruneForDeficit,
} = require("./scheduler");

exports.generateSchedule = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "generateSchedule", RATE_LIMITS.generateSchedule);

    try {
      const { courseId, availability, revisionPolicy } = data;

      // ── Parallel fetch: course, sections, SRS cards, done tasks, stats ──
      const [courseDoc, sectionsSnap, srsSnap, doneTasksSnap, statsDoc] = await Promise.all([
        db.doc(`users/${uid}/courses/${courseId}`).get(),
        db.collection(`users/${uid}/sections`)
          .where("courseId", "==", courseId)
          .where("aiStatus", "==", "ANALYZED")
          .orderBy("orderIndex")
          .get(),
        db.collection(`users/${uid}/srs`)
          .where("courseId", "==", courseId)
          .get(),
        db.collection(`users/${uid}/tasks`)
          .where("courseId", "==", courseId)
          .where("status", "==", "DONE")
          .where("type", "==", "STUDY")
          .get(),
        db.doc(`users/${uid}/stats/${courseId}`).get(),
      ]);

      if (!courseDoc.exists) return fail(Errors.NOT_FOUND, "Course not found.");
      const courseData = courseDoc.data();
      const examDate = courseData.examDate?.toDate();

      if (sectionsSnap.empty) return fail(Errors.NO_SECTIONS);

      const sections = sectionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aCreated = a.createdAt?.toMillis?.() ?? 0;
          const bCreated = b.createdAt?.toMillis?.() ?? 0;
          if (aCreated !== bCreated) return aCreated - bCreated;
          return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
        });

      const srsCards = new Map();
      srsSnap.docs.forEach((d) => {
        const data = d.data();
        if (data.sectionId) {
          srsCards.set(data.sectionId, {
            ...data,
            nextReview: data.nextReview?.toDate?.() || null,
            lastReview: data.lastReview?.toDate?.() || null,
          });
        }
      });

      // ── Pure algorithm ────────────────────────────────────────────────
      // Use canonical UTC midnight so task dates align with day boundaries everywhere
      const { toUTCMidnight } = require("../lib/utils");
      const startDate = toUTCMidnight(new Date());

      // Validate inputs before scheduling.
      const validationErrors = validateScheduleInputs(startDate, examDate);
      if (validationErrors.length > 0) {
        return fail(Errors.INVALID_ARGUMENT, validationErrors.join(" "));
      }

      // Exclude sections that already have completed (DONE) study tasks
      // (doneTasksSnap already fetched in parallel above)
      const doneSectionIds = new Set(
        doneTasksSnap.docs.flatMap((d) => d.data().sectionIds || [])
      );

      const schedulableSections = sections.filter((s) => !doneSectionIds.has(s.id));
      if (schedulableSections.length === 0 && doneSectionIds.size > 0) {
        // All sections already completed — nothing to schedule
        return ok({ taskCount: 0, skippedCount: 0, message: "All sections already completed." });
      }

      const adaptiveContext = buildAdaptiveContext({
        startDate,
        examDate,
        examType: courseData.examType || null,
        stats: statsDoc.exists ? statsDoc.data() : null,
      });

      // ── Triage v2: classify sections into schedule/backlog/defer ──────
      const inputSections = schedulableSections.length > 0 ? schedulableSections : sections;
      const { results: triageResults, scheduled: scheduledSections, backlog: backlogSections, deferred: deferredSections } =
        triageSections(inputSections, adaptiveContext);

      // Merge adjacent thin/low-priority sections to reduce fragmentation
      const mergedSections = mergeAdjacentThinSections(scheduledSections, triageResults);

      const tasks = buildWorkUnits(
        mergedSections,
        courseId, revisionPolicy, srsCards, adaptiveContext
      );

      // ── Capacity-aware deficit pruning ─────────────────────────────────
      const requestedDays = buildDayCapacities(startDate, examDate, availability);
      let days = requestedDays;
      const totalCapacity = days.reduce((sum, d) => sum + d.usableCapacity, 0);

      // If over capacity, prune lowest-priority tasks before extending
      const { kept: prunedTasks, pruned: droppedTasks } = pruneForDeficit(tasks, totalCapacity);
      const activeTasks = prunedTasks.length < tasks.length ? prunedTasks : tasks;

      const totalMinutes = computeTotalLoad(activeTasks);
      const requestedWindow = checkFeasibility(totalMinutes, requestedDays);
      let feasible = requestedWindow.feasible;
      let extendedWindow = false;

      if (!feasible) {
        const maxEndDate = new Date(startDate.getTime() + (MAX_SCHEDULE_DAYS - 1) * MS_PER_DAY);
        const extendedDays = buildDayCapacities(startDate, maxEndDate, availability);
        const extendedWindowCheck = checkFeasibility(totalMinutes, extendedDays);

        if (!extendedWindowCheck.feasible) {
          return ok({
            feasible: false,
            deficit: extendedWindowCheck.deficit,
            taskCount: activeTasks.length,
            suggestions: [
              "Increase daily study time",
              "Reduce revision intensity",
              "Reduce excluded study dates",
            ],
          });
        }

        days = extendedDays;
        feasible = true;
        extendedWindow = true;
      }

      const { placed, skipped } = placeTasks(activeTasks, days, { examDate, adaptiveContext });
      let spillDays = 0;
      if (extendedWindow && examDate && placed.length > 0) {
        const latestDueDate = placed.reduce(
          (latest, task) => (task.dueDate.getTime() > latest.getTime() ? task.dueDate : latest),
          placed[0].dueDate
        );
        spillDays = Math.max(0, Math.ceil((latestDueDate.getTime() - examDate.getTime()) / MS_PER_DAY));
      }

      // ── IDEMPOTENCY: Clear non-DONE tasks before writing ──────────────
      // Prevents duplicate tasks on repeated calls without using regenSchedule
      const existingSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .get();
      const toDelete = existingSnap.docs
        .filter((d) => d.data().status !== "DONE")
        .map((d) => d.ref);
      if (toDelete.length > 0) {
        await batchDelete(toDelete);
        log.info("Cleared existing non-DONE tasks", { uid, courseId, count: toDelete.length });
      }

      // ── Persist (convert plain Dates to Firestore Timestamps) ─────────
      await batchSet(
        placed.map((task) => ({
          ref: db.collection(`users/${uid}/tasks`).doc(),
          data: {
            ...task,
            dueDate: admin.firestore.Timestamp.fromDate(task.dueDate),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        }))
      );

      if (skipped.length > 0) {
        log.warn("Some tasks could not be placed", { uid, courseId, skippedCount: skipped.length });
      }

      log.info("Schedule generated", {
        uid,
        courseId,
        taskCount: placed.length,
        skippedCount: skipped.length,
        totalDays: days.length,
        extendedWindow,
        spillDays,
        adaptivePlanning: true,
        triage: {
          scheduled: scheduledSections.length,
          backlogged: backlogSections.length,
          deferred: deferredSections.length,
          prunedForDeficit: droppedTasks.length,
        },
      });

      return ok({
        feasible: true,
        taskCount: placed.length,
        skippedCount: skipped.length,
        totalDays: days.length,
        triage: {
          scheduled: scheduledSections.length,
          backlogged: backlogSections.length,
          deferred: deferredSections.length,
          prunedForDeficit: droppedTasks.length,
        },
        ...(extendedWindow
          ? {
              extendedWindow: true,
              spillDays,
              originalDeficit: requestedWindow.deficit,
            }
          : {}),
      });
    } catch (error) {
      return safeError(error, "schedule generation");
    }
  });
