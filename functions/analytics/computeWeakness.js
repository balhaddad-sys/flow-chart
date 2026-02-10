/**
 * @module analytics/computeWeakness
 * @description Firestore trigger that recomputes per-course stats and
 * per-topic weakness scores whenever a new quiz attempt is recorded.
 *
 * All statistical logic is delegated to the pure
 * {@link module:analytics/weakness} module.  This function handles only
 * Firestore I/O, throttling, and persistence.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { FIRESTORE_GET_ALL_LIMIT, STATS_THROTTLE_SEC } = require("../lib/constants");
const log = require("../lib/logger");
const {
  accumulateTopicStats,
  rankWeakTopics,
  computeOverallAccuracy,
  computeCompletionStats,
} = require("./weakness");

exports.computeWeakness = functions
  .runWith({ timeoutSeconds: 60 })
  .firestore.document("users/{uid}/attempts/{attemptId}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const attempt = snap.data();
    const { courseId } = attempt;

    if (!courseId) {
      log.warn("Attempt missing courseId, skipping weakness computation", { uid, attemptId: context.params.attemptId });
      return null;
    }

    try {
      // ── Throttle ────────────────────────────────────────────────────────
      const statsDoc = await db.doc(`users/${uid}/stats/${courseId}`).get();
      if (statsDoc.exists) {
        const lastUpdated = statsDoc.data().updatedAt?.toDate();
        if (lastUpdated) {
          const secSinceUpdate = (Date.now() - lastUpdated.getTime()) / 1000;
          if (secSinceUpdate < STATS_THROTTLE_SEC) {
            log.debug("Stats computation throttled", { uid, courseId, secSinceUpdate: Math.round(secSinceUpdate) });
            return null;
          }
        }
      }

      // ── Fetch attempts ─────────────────────────────────────────────────
      const attemptsSnap = await db
        .collection(`users/${uid}/attempts`)
        .where("courseId", "==", courseId)
        .get();
      const attempts = attemptsSnap.docs.map((d) => d.data());

      // ── Fetch referenced questions ─────────────────────────────────────
      const uniqueQuestionIds = [...new Set(attempts.map((a) => a.questionId).filter(Boolean))];
      const questionMap = new Map();

      for (let i = 0; i < uniqueQuestionIds.length; i += FIRESTORE_GET_ALL_LIMIT) {
        const batch = uniqueQuestionIds.slice(i, i + FIRESTORE_GET_ALL_LIMIT);
        const refs = batch.map((id) => db.doc(`users/${uid}/questions/${id}`));
        const docs = await db.getAll(...refs);
        for (const doc of docs) {
          if (doc.exists) questionMap.set(doc.id, doc.data());
        }
      }

      // ── Pure computation ───────────────────────────────────────────────
      const { totalAnswered, overallAccuracy } = computeOverallAccuracy(attempts);
      const topicMap = accumulateTopicStats(attempts, questionMap);
      const weakestTopics = rankWeakTopics(topicMap);

      // ── Task completion stats (single query) ───────────────────────────
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .get();
      const taskData = tasksSnap.docs.map((d) => d.data());
      const { totalStudyMinutes, completionPercent } = computeCompletionStats(taskData);

      // ── Persist ────────────────────────────────────────────────────────
      await db.doc(`users/${uid}/stats/${courseId}`).set(
        {
          totalStudyMinutes,
          totalQuestionsAnswered: totalAnswered,
          overallAccuracy: Math.round(overallAccuracy * 1000) / 1000,
          completionPercent: Math.round(completionPercent * 1000) / 1000,
          weakestTopics,
          lastStudiedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      log.info("Course stats updated", { uid, courseId, totalAnswered, accuracy: (overallAccuracy * 100).toFixed(1) });
    } catch (error) {
      log.error("computeWeakness failed", { uid, courseId, error: error.message });
    }
  });
