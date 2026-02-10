/**
 * @module analytics/computeWeakness
 * @description Firestore trigger that recomputes per-course stats and
 * per-topic weakness scores whenever a new quiz attempt is recorded.
 *
 * Throttled to run at most once every {@link STATS_THROTTLE_SEC} seconds per
 * course to avoid excessive recomputation during rapid-fire quiz sessions.
 *
 * Weakness formula (per topic):
 *   0.6 * errorRate + 0.3 * recencyPenalty + 0.1 * speedPenalty
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const {
  FIRESTORE_GET_ALL_LIMIT,
  MS_PER_DAY,
  STATS_THROTTLE_SEC,
  WEAK_TOPICS_LIMIT,
} = require("../lib/constants");
const { computeWeaknessScore } = require("../questions/questionSelection");

exports.computeWeakness = functions
  .runWith({ timeoutSeconds: 60 })
  .firestore.document("users/{uid}/attempts/{attemptId}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const attempt = snap.data();
    const { courseId } = attempt;

    if (!courseId) return null;

    try {
      // ── Throttle ────────────────────────────────────────────────────────
      const statsDoc = await db.doc(`users/${uid}/stats/${courseId}`).get();
      if (statsDoc.exists) {
        const lastUpdated = statsDoc.data().updatedAt?.toDate();
        if (lastUpdated) {
          const secSinceUpdate = (Date.now() - lastUpdated.getTime()) / 1000;
          if (secSinceUpdate < STATS_THROTTLE_SEC) {
            console.log(`Stats for ${courseId} updated ${secSinceUpdate.toFixed(0)}s ago, skipping.`);
            return null;
          }
        }
      }

      // ── Fetch all attempts for this course ─────────────────────────────
      const attemptsSnap = await db
        .collection(`users/${uid}/attempts`)
        .where("courseId", "==", courseId)
        .get();

      const attempts = attemptsSnap.docs.map((d) => d.data());

      // ── Overall accuracy ───────────────────────────────────────────────
      const totalAnswered = attempts.length;
      const totalCorrect = attempts.filter((a) => a.correct).length;
      const overallAccuracy = totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

      // ── Batch-fetch referenced questions ───────────────────────────────
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

      // ── Per-topic weakness scores ──────────────────────────────────────
      const topicMap = new Map();

      for (const att of attempts) {
        const question = questionMap.get(att.questionId);
        if (!question) continue;

        for (const tag of question.topicTags || []) {
          if (!topicMap.has(tag)) {
            topicMap.set(tag, { totalAttempts: 0, wrongAttempts: 0, totalTimeSec: 0, lastAttemptDate: null });
          }
          const t = topicMap.get(tag);
          t.totalAttempts++;
          if (!att.correct) t.wrongAttempts++;
          t.totalTimeSec += att.timeSpentSec || 0;

          const attemptDate = att.createdAt?.toDate?.() || new Date();
          if (!t.lastAttemptDate || attemptDate > t.lastAttemptDate) {
            t.lastAttemptDate = attemptDate;
          }
        }
      }

      const now = new Date();
      const weakTopics = [];

      for (const [tag, stats] of topicMap.entries()) {
        const daysSinceLastReview = stats.lastAttemptDate
          ? Math.floor((now - stats.lastAttemptDate) / MS_PER_DAY)
          : 14;
        const avgTimePerQ = stats.totalAttempts > 0 ? stats.totalTimeSec / stats.totalAttempts : 0;

        const weaknessScore = computeWeaknessScore({
          wrongAttempts: stats.wrongAttempts,
          totalAttempts: stats.totalAttempts,
          daysSinceLastReview,
          avgTimePerQ,
          expectedTime: 60,
        });

        const accuracy = stats.totalAttempts > 0
          ? (stats.totalAttempts - stats.wrongAttempts) / stats.totalAttempts
          : 0;

        weakTopics.push({ tag, weaknessScore, accuracy });
      }

      weakTopics.sort((a, b) => b.weaknessScore - a.weaknessScore);
      const top = weakTopics.slice(0, WEAK_TOPICS_LIMIT);

      // ── Study minutes & completion ─────────────────────────────────────
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .get();

      let totalStudyMinutes = 0;
      let completedTasks = 0;
      for (const doc of tasksSnap.docs) {
        const t = doc.data();
        if (t.status === "DONE") {
          totalStudyMinutes += t.actualMinutes || t.estMinutes || 0;
          completedTasks++;
        }
      }

      const completionPercent = tasksSnap.size > 0 ? completedTasks / tasksSnap.size : 0;

      // ── Persist stats ──────────────────────────────────────────────────
      await db.doc(`users/${uid}/stats/${courseId}`).set(
        {
          totalStudyMinutes,
          totalQuestionsAnswered: totalAnswered,
          overallAccuracy: Math.round(overallAccuracy * 1000) / 1000,
          completionPercent: Math.round(completionPercent * 1000) / 1000,
          weakestTopics: top,
          lastStudiedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`Stats updated for course ${courseId}: ${totalAnswered} attempts, accuracy ${(overallAccuracy * 100).toFixed(1)}%`);
    } catch (error) {
      console.error("computeWeakness error:", error);
    }
  });
