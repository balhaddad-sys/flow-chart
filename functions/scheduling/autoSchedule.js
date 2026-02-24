/**
 * @module scheduling/autoSchedule
 * @description Internal function that auto-generates a study schedule after
 * all files in a course finish processing. Called from processSection when
 * the last section is marked ANALYZED.
 *
 * This mirrors the logic in generateSchedule.js but runs without user auth
 * context (it's a background trigger, not a callable).
 */

const admin = require("firebase-admin");
const { db, batchSet } = require("../lib/firestore");
const log = require("../lib/logger");
const { MS_PER_DAY, MAX_SCHEDULE_DAYS } = require("../lib/constants");
const {
  buildWorkUnits,
  computeTotalLoad,
  buildDayCapacities,
  checkFeasibility,
  placeTasks,
} = require("./scheduler");

/**
 * Check whether all files for a course are fully processed, and if no
 * study plan exists yet, automatically generate one.
 *
 * Safe to call multiple times — it no-ops if tasks already exist or
 * if any files are still processing.
 *
 * @param {string} uid
 * @param {string} courseId
 */
async function maybeAutoGenerateSchedule(uid, courseId) {
  if (!uid || !courseId) return;

  try {
    // ── Check all files for this course are done ──────────────────────
    const filesSnap = await db
      .collection(`users/${uid}/files`)
      .where("courseId", "==", courseId)
      .get();

    if (filesSnap.empty) return;

    const allFilesDone = filesSnap.docs.every((d) => {
      const status = d.data().status;
      return status === "READY" || status === "FAILED";
    });

    if (!allFilesDone) return; // Some files still processing

    // ── Check we have analyzed sections to schedule ───────────────────
    const sectionsSnap = await db
      .collection(`users/${uid}/sections`)
      .where("courseId", "==", courseId)
      .where("aiStatus", "==", "ANALYZED")
      .orderBy("orderIndex")
      .get();

    if (sectionsSnap.empty) return; // No analyzable content

    // ── Skip if tasks already exist (user already has a plan) ─────────
    const existingTasks = await db
      .collection(`users/${uid}/tasks`)
      .where("courseId", "==", courseId)
      .limit(1)
      .get();

    if (!existingTasks.empty) {
      log.info("Auto-schedule skipped: tasks already exist", { uid, courseId });
      return;
    }

    // ── Fetch course for exam date and availability ───────────────────
    const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
    if (!courseDoc.exists) return;

    const courseData = courseDoc.data();
    const examDate = courseData.examDate?.toDate?.() || null;
    const availability = courseData.availability || undefined;

    // ── Run the pure scheduling algorithm ─────────────────────────────
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

    const startDate = new Date();
    const tasks = buildWorkUnits(sections, courseId, "standard", srsCards);
    const totalMinutes = computeTotalLoad(tasks);
    let days = buildDayCapacities(startDate, examDate, availability);
    const { feasible } = checkFeasibility(totalMinutes, days);

    if (!feasible) {
      const maxEndDate = new Date(startDate.getTime() + (MAX_SCHEDULE_DAYS - 1) * MS_PER_DAY);
      const extendedDays = buildDayCapacities(startDate, maxEndDate, availability);
      const extended = checkFeasibility(totalMinutes, extendedDays);
      if (!extended.feasible) {
        log.warn("Auto-schedule infeasible even with extended window", {
          uid,
          courseId,
          deficit: extended.deficit,
        });
        return; // User will need to adjust availability manually
      }
      days = extendedDays;
    }

    const placed = placeTasks(tasks, days);
    if (placed.length === 0) return;

    // ── Persist tasks ─────────────────────────────────────────────────
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

    log.info("Auto-schedule generated after file processing", {
      uid,
      courseId,
      taskCount: placed.length,
      totalDays: days.length,
    });
  } catch (err) {
    // Non-fatal: user can still generate manually from /today/plan
    log.warn("Auto-schedule generation failed (non-fatal)", {
      uid,
      courseId,
      error: err.message,
    });
  }
}

module.exports = { maybeAutoGenerateSchedule };
