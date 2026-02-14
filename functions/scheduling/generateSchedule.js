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
const { buildWorkUnits, computeTotalLoad, buildDayCapacities, checkFeasibility, placeTasks } = require("./scheduler");

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

      // ── Pure algorithm ────────────────────────────────────────────────
      const tasks = buildWorkUnits(sections, courseId, revisionPolicy);
      const totalMinutes = computeTotalLoad(tasks);
      const days = buildDayCapacities(new Date(), examDate, availability);
      const { feasible, deficit } = checkFeasibility(totalMinutes, days);

      if (!feasible) {
        return ok({
          feasible: false,
          deficit,
          taskCount: tasks.length,
          suggestions: [
            "Increase daily study time",
            "Reduce revision intensity",
            "Extend your study period",
          ],
        });
      }

      const placed = placeTasks(tasks, days);

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

      log.info("Schedule generated", { uid, courseId, taskCount: placed.length, totalDays: days.length });

      return ok({ feasible: true, taskCount: placed.length, totalDays: days.length });
    } catch (error) {
      return safeError(error, "schedule generation");
    }
  });
