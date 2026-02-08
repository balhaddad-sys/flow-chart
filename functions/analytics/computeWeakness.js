const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { computeWeaknessScore } = require("../questions/questionSelection");

const db = admin.firestore();

/**
 * Firestore trigger: when a new attempt is created, recompute
 * course stats and weakness scores.
 */
exports.computeWeakness = functions
  .runWith({ timeoutSeconds: 60 })
  .firestore.document("users/{uid}/attempts/{attemptId}")
  .onCreate(async (snap, context) => {
    const { uid } = context.params;
    const attempt = snap.data();
    const { courseId } = attempt;

    if (!courseId) return null;

    try {
      // Throttle: skip recomputation if stats were updated less than 30s ago
      const statsDoc = await db.doc(`users/${uid}/stats/${courseId}`).get();
      if (statsDoc.exists) {
        const lastUpdated = statsDoc.data().updatedAt?.toDate();
        if (lastUpdated) {
          const secondsSinceUpdate = (Date.now() - lastUpdated.getTime()) / 1000;
          if (secondsSinceUpdate < 30) {
            console.log(`Stats for ${courseId} updated ${secondsSinceUpdate.toFixed(0)}s ago, skipping.`);
            return null;
          }
        }
      }
      // Fetch all attempts for this course
      const attemptsSnap = await db
        .collection(`users/${uid}/attempts`)
        .where("courseId", "==", courseId)
        .get();

      const attempts = attemptsSnap.docs.map((d) => d.data());

      // Compute overall stats
      const totalAnswered = attempts.length;
      const totalCorrect = attempts.filter((a) => a.correct).length;
      const overallAccuracy =
        totalAnswered > 0 ? totalCorrect / totalAnswered : 0;

      // Batch-fetch all unique questions referenced by attempts
      const uniqueQuestionIds = [
        ...new Set(attempts.map((a) => a.questionId).filter(Boolean)),
      ];
      const questionMap = new Map();

      // Firestore getAll supports up to 100 refs per call
      const BATCH_SIZE = 100;
      for (let i = 0; i < uniqueQuestionIds.length; i += BATCH_SIZE) {
        const batch = uniqueQuestionIds.slice(i, i + BATCH_SIZE);
        const refs = batch.map((id) =>
          db.doc(`users/${uid}/questions/${id}`)
        );
        const docs = await db.getAll(...refs);
        for (const doc of docs) {
          if (doc.exists) {
            questionMap.set(doc.id, doc.data());
          }
        }
      }

      // Compute per-topic weakness scores
      const topicMap = new Map();

      for (const att of attempts) {
        const question = questionMap.get(att.questionId);
        if (!question) continue;

        for (const tag of question.topicTags || []) {
          if (!topicMap.has(tag)) {
            topicMap.set(tag, {
              totalAttempts: 0,
              wrongAttempts: 0,
              totalTimeSec: 0,
              lastAttemptDate: null,
            });
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

      // Compute weakness scores and sort
      const now = new Date();
      const weakTopics = [];

      for (const [tag, stats] of topicMap.entries()) {
        const daysSinceLastReview = stats.lastAttemptDate
          ? Math.floor((now - stats.lastAttemptDate) / 86400000)
          : 14;
        const avgTimePerQ =
          stats.totalAttempts > 0
            ? stats.totalTimeSec / stats.totalAttempts
            : 0;

        const weaknessScore = computeWeaknessScore({
          wrongAttempts: stats.wrongAttempts,
          totalAttempts: stats.totalAttempts,
          daysSinceLastReview,
          avgTimePerQ,
          expectedTime: 60,
        });

        const accuracy =
          stats.totalAttempts > 0
            ? (stats.totalAttempts - stats.wrongAttempts) / stats.totalAttempts
            : 0;

        weakTopics.push({ tag, weaknessScore, accuracy });
      }

      // Sort by weakness score descending, take top 5
      weakTopics.sort((a, b) => b.weaknessScore - a.weaknessScore);
      const top5 = weakTopics.slice(0, 5);

      // Compute total study minutes from completed tasks
      const tasksSnap = await db
        .collection(`users/${uid}/tasks`)
        .where("courseId", "==", courseId)
        .where("status", "==", "DONE")
        .get();

      const totalStudyMinutes = tasksSnap.docs.reduce(
        (sum, d) => sum + (d.data().actualMinutes || d.data().estMinutes || 0),
        0
      );

      const totalTasks = (
        await db
          .collection(`users/${uid}/tasks`)
          .where("courseId", "==", courseId)
          .get()
      ).size;

      const completedTasks = tasksSnap.size;
      const completionPercent =
        totalTasks > 0 ? completedTasks / totalTasks : 0;

      // Update stats document
      await db.doc(`users/${uid}/stats/${courseId}`).set(
        {
          totalStudyMinutes,
          totalQuestionsAnswered: totalAnswered,
          overallAccuracy: Math.round(overallAccuracy * 1000) / 1000,
          completionPercent: Math.round(completionPercent * 1000) / 1000,
          weakestTopics: top5,
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
