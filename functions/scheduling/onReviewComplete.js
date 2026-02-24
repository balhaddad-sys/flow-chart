/**
 * @module scheduling/onReviewComplete
 * @description Firestore trigger that fires when a task is updated.
 *
 * When a REVIEW task is marked DONE, this trigger:
 *   1. Fetches or creates an FSRS SRS card for the section
 *   2. Grades the review based on recent quiz attempts
 *   3. Applies FSRS v5 formulas to compute the next optimal review interval
 *   4. Saves the updated SRS card
 *   5. Creates a new REVIEW task at the computed interval
 *
 * This is the core of the adaptive spaced repetition system — it replaces
 * static fixed-interval reviews with neural-network-derived adaptive spacing.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const log = require("../lib/logger");
const {
  MS_PER_DAY,
  FSRS_DESIRED_RETENTION,
  FSRS_MIN_INTERVAL,
  FSRS_MAX_INTERVAL,
  FSRS_ATTEMPT_LOOKBACK_DAYS,
} = require("../lib/constants");
const {
  reviewCard,
  createBlankCard,
  gradeFromPerformance,
  GRADE,
} = require("../lib/fsrs");

/**
 * Fetch recent quiz attempts for questions belonging to a specific section.
 *
 * @param {string} uid
 * @param {string} sectionId
 * @param {number} lookbackDays
 * @returns {Promise<{ accuracy: number, avgTimeSec: number, avgConfidence: number, count: number }>}
 */
async function getSectionAttemptStats(uid, sectionId, lookbackDays) {
  // Find questions for this section
  const questionsSnap = await db
    .collection(`users/${uid}/questions`)
    .where("sectionId", "==", sectionId)
    .select("id") // only need IDs
    .get();

  if (questionsSnap.empty) {
    return { accuracy: 0.5, avgTimeSec: 30, avgConfidence: 0, count: 0 };
  }

  const questionIds = new Set(questionsSnap.docs.map((d) => d.id));

  // Fetch recent attempts
  const cutoff = admin.firestore.Timestamp.fromDate(
    new Date(Date.now() - lookbackDays * MS_PER_DAY)
  );

  const attemptsSnap = await db
    .collection(`users/${uid}/attempts`)
    .where("createdAt", ">=", cutoff)
    .orderBy("createdAt", "desc")
    .limit(200) // reasonable cap
    .get();

  // Filter to attempts for this section's questions
  const relevant = attemptsSnap.docs
    .map((d) => d.data())
    .filter((a) => questionIds.has(a.questionId));

  if (relevant.length === 0) {
    return { accuracy: 0.5, avgTimeSec: 30, avgConfidence: 0, count: 0 };
  }

  const correct = relevant.filter((a) => a.correct).length;
  const accuracy = correct / relevant.length;
  const avgTimeSec =
    relevant.reduce((sum, a) => sum + (a.timeSpentSec || 0), 0) / relevant.length;
  const withConfidence = relevant.filter((a) => a.confidence != null);
  const avgConfidence =
    withConfidence.length > 0
      ? withConfidence.reduce((sum, a) => sum + a.confidence, 0) / withConfidence.length
      : 0;

  return { accuracy, avgTimeSec, avgConfidence, count: relevant.length };
}

exports.onReviewComplete = functions
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .firestore.document("users/{uid}/tasks/{taskId}")
  .onUpdate(async (change, context) => {
    const { uid } = context.params;
    const before = change.before.data();
    const after = change.after.data();

    // Only trigger when status changes to DONE on a REVIEW task
    if (after.type !== "REVIEW") return;
    if (before.status === "DONE" || after.status !== "DONE") return;

    const sectionId = (after.sectionIds || [])[0];
    if (!sectionId) {
      log.warn("onReviewComplete: REVIEW task has no sectionId", { uid, taskId: context.params.taskId });
      return;
    }

    try {
      // ── Fetch or create SRS card ────────────────────────────────────────
      const srsRef = db.doc(`users/${uid}/srs/${sectionId}`);
      const srsDoc = await srsRef.get();

      let card;
      if (srsDoc.exists) {
        const data = srsDoc.data();
        card = {
          state: data.state || "New",
          stability: data.stability || 0,
          difficulty: data.difficulty || 0,
          reps: data.reps || 0,
          lapses: data.lapses || 0,
          interval: data.interval || 0,
          lastReview: data.lastReview?.toDate?.() || null,
        };
      } else {
        card = createBlankCard(sectionId, after.courseId);
      }

      // ── Compute elapsed days since last review ──────────────────────────
      let elapsedDays = 0;
      if (card.lastReview) {
        elapsedDays = Math.max(0, (Date.now() - card.lastReview.getTime()) / MS_PER_DAY);
      }

      // ── Grade the review based on recent quiz attempts ──────────────────
      const stats = await getSectionAttemptStats(uid, sectionId, FSRS_ATTEMPT_LOOKBACK_DAYS);

      let grade;
      if (stats.count === 0) {
        // No quiz data available — default to Good (neutral assumption)
        grade = GRADE.Good;
      } else {
        grade = gradeFromPerformance(stats.accuracy, stats.avgTimeSec, stats.avgConfidence);
      }

      // ── Apply FSRS v5 ──────────────────────────────────────────────────
      const updated = reviewCard(
        card,
        grade,
        elapsedDays,
        FSRS_DESIRED_RETENTION,
        FSRS_MIN_INTERVAL,
        FSRS_MAX_INTERVAL
      );

      // ── Save updated SRS card ──────────────────────────────────────────
      await srsRef.set(
        {
          sectionId,
          courseId: after.courseId,
          state: updated.state,
          stability: updated.stability,
          difficulty: updated.difficulty,
          reps: updated.reps,
          lapses: updated.lapses,
          interval: updated.interval,
          lastReview: admin.firestore.Timestamp.fromDate(updated.lastReview),
          nextReview: admin.firestore.Timestamp.fromDate(updated.nextReview),
          lastGrade: grade,
          lastAccuracy: stats.accuracy,
          lastAttemptCount: stats.count,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // ── Create the next REVIEW task ────────────────────────────────────
      const nextDueDate = updated.nextReview;
      const reviewTitle = after.title || `Review: Section`;

      await db.collection(`users/${uid}/tasks`).add({
        courseId: after.courseId,
        type: "REVIEW",
        title: reviewTitle,
        sectionIds: [sectionId],
        topicTags: after.topicTags || [],
        estMinutes: Math.max(10, Math.min(30, Math.round(10 + (updated.difficulty / 10) * 20))),
        difficulty: after.difficulty || 3,
        status: "TODO",
        isPinned: false,
        priority: 0,
        dueDate: admin.firestore.Timestamp.fromDate(nextDueDate),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        fsrsGenerated: true, // flag to identify FSRS-generated tasks
      });

      log.info("FSRS review processed", {
        uid,
        sectionId,
        grade,
        accuracy: stats.accuracy,
        attemptCount: stats.count,
        oldStability: card.stability,
        newStability: updated.stability,
        interval: updated.interval,
        nextReview: nextDueDate.toISOString(),
      });
    } catch (err) {
      // Non-fatal: user can still study without adaptive scheduling
      log.warn("onReviewComplete failed (non-fatal)", {
        uid,
        sectionId,
        error: err.message,
      });
    }
  });
