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
const { buildWorkUnits, computeTotalLoad, buildDayCapacities, checkFeasibility, placeTasks, validateScheduleInputs } = require("./scheduler");

exports.generateSchedule = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "generateSchedule", RATE_LIMITS.generateSchedule);

    try {
      const { courseId, availability, revisionPolicy } = data;

      // ── Fetch course ──────────────────────────────────────────────────
      const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
      if (!courseDoc.exists) return fail(Errors.NOT_FOUND, "Course not found.");
      const examDate = courseDoc.data().examDate?.toDate();

      // ── Fetch analysed sections ───────────────────────────────────────
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("courseId", "==", courseId)
        .where("aiStatus", "==", "ANALYZED")
        .orderBy("orderIndex")
        .get();

      if (sectionsSnap.empty) return fail(Errors.NO_SECTIONS);

      const sections = sectionsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const aCreated = a.createdAt?.toMillis?.() ?? 0;
          const bCreated = b.createdAt?.toMillis?.() ?? 0;
          if (aCreated !== bCreated) return aCreated - bCreated;
          return (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
        });

      // ── Fetch FSRS SRS cards for adaptive review intervals ──────────
      const srsSnap = await db
        .collection(`users/${uid}/srs`)
        .where("courseId", "==", courseId)
        .get();
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
      const startDate = new Date();

      // Validate inputs before scheduling.
      const validationErrors = validateScheduleInputs(startDate, examDate);
      if (validationErrors.length > 0) {
        return fail(Errors.INVALID_ARGUMENT, validationErrors.join(" "));
      }

      const tasks = buildWorkUnits(sections, courseId, revisionPolicy, srsCards);
      const totalMinutes = computeTotalLoad(tasks);
      const requestedDays = buildDayCapacities(startDate, examDate, availability);
      let days = requestedDays;
      const requestedWindow = checkFeasibility(totalMinutes, requestedDays);
      let feasible = requestedWindow.feasible;
      let extendedWindow = false;

      if (!feasible) {
        // Relax strict date-window fitting: if the selected study period is too
        // short, retry against the maximum supported horizon.
        const maxEndDate = new Date(startDate.getTime() + (MAX_SCHEDULE_DAYS - 1) * MS_PER_DAY);
        const extendedDays = buildDayCapacities(startDate, maxEndDate, availability);
        const extendedWindowCheck = checkFeasibility(totalMinutes, extendedDays);

        if (!extendedWindowCheck.feasible) {
          return ok({
            feasible: false,
            deficit: extendedWindowCheck.deficit,
            taskCount: tasks.length,
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

      const { placed, skipped } = placeTasks(tasks, days, { examDate });
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
      });

      return ok({
        feasible: true,
        taskCount: placed.length,
        skippedCount: skipped.length,
        totalDays: days.length,
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
