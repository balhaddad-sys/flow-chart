/**
 * @module scheduling/catchUp
 * @description Callable function that redistributes overdue TODO tasks.
 *
 * Delegates the redistribution algorithm to the pure
 * {@link module:scheduling/distributor} and handles only Firestore I/O here.
 *
 * @param {Object} data
 * @param {string} data.courseId
 * @returns {{ success: true, data: { redistributedCount: number, message: string } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchUpdate } = require("../lib/firestore");
const { ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { CATCH_UP_SPAN_DAYS, MS_PER_DAY } = require("../lib/constants");
const { distributeOverdue } = require("./distributor");
const { buildDayCapacities } = require("./scheduler");

exports.catchUp = functions
  .runWith({ timeoutSeconds: 60 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "catchUp", RATE_LIMITS.catchUp);

    try {
      const { courseId } = data;
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Fetch overdue TODO tasks
      const overdueSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .where("status", "==", "TODO")
        .where("dueDate", "<", admin.firestore.Timestamp.fromDate(today))
        .get();

      if (overdueSnap.empty) {
        return ok({ redistributedCount: 0, message: "No overdue tasks." });
      }

      // Build capacity-aware day slots for catch-up window.
      const [courseDoc, userDoc] = await Promise.all([
        db.doc(`users/${uid}/courses/${courseId}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);
      const userPrefs = userDoc.exists ? (userDoc.data().preferences || {}) : {};
      const catchUpEnd = new Date(today.getTime() + CATCH_UP_SPAN_DAYS * MS_PER_DAY);
      const dayCapacities = buildDayCapacities(today, catchUpEnd, {
        defaultMinutesPerDay: userPrefs.dailyMinutesDefault || 120,
        catchUpBufferPercent: 0, // Use full capacity for catch-up.
        ...(courseDoc.exists ? (courseDoc.data().availability || {}) : {}),
      });

      // Pure algorithm (capacity-aware).
      const items = overdueSnap.docs.map((doc) => ({
        ref: doc.ref,
        estMinutes: doc.data().estMinutes || 15,
      }));
      const redistributed = distributeOverdue(items, today, CATCH_UP_SPAN_DAYS, dayCapacities);

      // Persist
      await batchUpdate(
        redistributed.map((r) => ({
          ref: r.ref,
          data: {
            dueDate: admin.firestore.Timestamp.fromDate(r.newDate),
            priority: r.priority,
          },
        }))
      );

      log.info("Catch-up completed", { uid, courseId, redistributedCount: redistributed.length });

      return ok({
        redistributedCount: redistributed.length,
        message: `Redistributed ${redistributed.length} overdue tasks across next ${CATCH_UP_SPAN_DAYS} days.`,
      });
    } catch (error) {
      return safeError(error, "catch-up scheduling");
    }
  });
