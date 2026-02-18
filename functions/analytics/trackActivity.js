/**
 * @module analytics/trackActivity
 * @description Firestore trigger that maintains the `activity/{uid}/days/{date}`
 * document whenever a new attempt is recorded.
 *
 * This powers the GitHub-style 12-week contribution graph and streak counters
 * on the dashboard.  Each day document stores:
 *   - `completedCount`  — total questions answered that day
 *   - `minutesStudied`  — derived from `timeSpentSec` across attempts
 *   - `correctCount`    — correct answers that day
 *   - `date`            — ISO date string (YYYY-MM-DD)
 *
 * Streak computation is done on the client from the `activity` sub-collection.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const log = require("../lib/logger");

exports.trackActivity = functions
  .runWith({ timeoutSeconds: 30 })
  .firestore.document("users/{uid}/attempts/{attemptId}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const attempt = snap.data();

    try {
      const now = new Date();
      // Use UTC date so activity is consistent across timezones
      const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

      const dayRef = db.doc(`users/${uid}/activity/${dateKey}`);

      await dayRef.set(
        {
          date: dateKey,
          completedCount: admin.firestore.FieldValue.increment(1),
          correctCount: admin.firestore.FieldValue.increment(attempt.correct ? 1 : 0),
          minutesStudied: admin.firestore.FieldValue.increment(
            Math.round((attempt.timeSpentSec || 0) / 60)
          ),
          lastActivityAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      log.debug("Activity tracked", { uid, dateKey });
    } catch (error) {
      // Non-critical: do not propagate — streak tracking must not disrupt the
      // main attempt recording flow.
      log.warn("trackActivity failed (non-critical)", { uid, error: error.message });
    }
  });
