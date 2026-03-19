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
      return status === "READY" || status === "READY_PARTIAL" || status === "FAILED";
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

    // ── Acquire course-level lock to prevent duplicate schedule generation ──
    // Uses a Firestore document as a distributed lock. If two processSection
    // completions race, only one will successfully create the lock doc.
    const lockRef = db.doc(`users/${uid}/courses/${courseId}`);
    try {
      const lockResult = await db.runTransaction(async (tx) => {
        const courseDoc = await tx.get(lockRef);
        const courseData = courseDoc.data() || {};

        // Skip if already scheduled or lock is held
        if (courseData._autoScheduleLock) {
          return { locked: false, reason: "lock already held" };
        }

        // Check if tasks already exist
        const existingTasks = await db
          .collection(`users/${uid}/tasks`)
          .where("courseId", "==", courseId)
          .limit(1)
          .get();

        if (!existingTasks.empty) {
          return { locked: false, reason: "tasks already exist" };
        }

        // Acquire lock
        tx.update(lockRef, {
          _autoScheduleLock: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { locked: true };
      });

      if (!lockResult.locked) {
        log.info("Auto-schedule skipped", { uid, courseId, reason: lockResult.reason });
        return;
      }
    } catch (lockErr) {
      // Transaction failed (contention) — another instance won the race
      log.info("Auto-schedule lock contention, skipping", { uid, courseId, error: lockErr.message });
      return;
    }

    // ── Fetch course and user preferences ────────────────────────────
    const [courseDoc, userDoc, statsDoc] = await Promise.all([
      db.doc(`users/${uid}/courses/${courseId}`).get(),
      db.doc(`users/${uid}`).get(),
      db.doc(`users/${uid}/stats/${courseId}`).get(),
    ]);
    if (!courseDoc.exists) return;

    const courseData = courseDoc.data();
    const examDate = courseData.examDate?.toDate?.() || null;
    const userPrefs = userDoc.exists ? (userDoc.data().preferences || {}) : {};
    const revisionPolicy = userPrefs.revisionPolicy || "standard";

    // Merge user default daily minutes with course-level availability overrides.
    // Use nullish coalescing (??) to preserve explicit zero values
    const availability = {
      defaultMinutesPerDay: userPrefs.dailyMinutesDefault ?? 120,
      catchUpBufferPercent: userPrefs.catchUpBufferPercent ?? 15,
      ...(courseData.availability || {}),
    };

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

    // Use canonical UTC midnight — same as manual generateSchedule
    const { toUTCMidnight } = require("../lib/utils");
    const startDate = toUTCMidnight(new Date());

    // Validate inputs.
    const validationErrors = validateScheduleInputs(startDate, examDate);
    if (validationErrors.length > 0) {
      log.warn("Auto-schedule skipped: invalid inputs", { uid, courseId, errors: validationErrors });
      return;
    }

    const adaptiveContext = buildAdaptiveContext({
      startDate,
      examDate,
      examType: courseData.examType || null,
      stats: statsDoc.exists ? statsDoc.data() : null,
    });

    // ── Triage + merge + prune — same pipeline as manual generateSchedule ──
    const { results: triageResults, scheduled: scheduledSections } =
      triageSections(sections, adaptiveContext);
    const mergedSections = mergeAdjacentThinSections(
      scheduledSections.length > 0 ? scheduledSections : sections,
      triageResults
    );

    const allTasks = buildWorkUnits(mergedSections, courseId, revisionPolicy, srsCards, adaptiveContext);

    // Capacity-aware deficit pruning
    let days = buildDayCapacities(startDate, examDate, availability);
    const totalCapacity = days.reduce((sum, d) => sum + d.usableCapacity, 0);
    const { kept: prunedTasks } = pruneForDeficit(allTasks, totalCapacity);
    const tasks = prunedTasks.length < allTasks.length ? prunedTasks : allTasks;

    const totalMinutes = computeTotalLoad(tasks);
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

    const { placed, skipped } = placeTasks(tasks, days, { examDate, adaptiveContext });
    if (placed.length === 0) return;

    if (skipped.length > 0) {
      log.warn("Auto-schedule: some tasks could not be placed", { uid, courseId, skippedCount: skipped.length });
    }

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
      skippedCount: skipped.length,
      totalDays: days.length,
      adaptivePlanning: true,
    });
  } catch (err) {
    // Non-fatal: user can still generate manually from /today/plan
    log.warn("Auto-schedule generation failed (non-fatal)", {
      uid,
      courseId,
      error: err.message,
    });

    // Release the lock so auto-schedule can retry on next file completion
    try {
      await db.doc(`users/${uid}/courses/${courseId}`).update({
        _autoScheduleLock: admin.firestore.FieldValue.delete(),
      });
    } catch (unlockErr) {
      log.warn("Failed to release auto-schedule lock", { uid, courseId, error: unlockErr.message });
    }
  }
}

module.exports = { maybeAutoGenerateSchedule };
