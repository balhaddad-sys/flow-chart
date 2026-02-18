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

/**
 * Converts raw weakness data into directive sentences a student can act on.
 * @param {Array} weakestTopics
 * @param {number} overallAccuracy  0–1
 * @returns {string[]} Up to 3 action-oriented directives.
 */
function buildDiagnosticDirectives(weakestTopics, overallAccuracy) {
  const directives = [];

  if (weakestTopics.length === 0) {
    if (overallAccuracy >= 0.8) {
      directives.push("Great work — your overall accuracy is strong. Keep reinforcing with mixed-mode quizzes.");
    } else {
      directives.push("Complete more practice questions so we can identify your focus areas.");
    }
    return directives;
  }

  const [top] = weakestTopics;
  const pct = Math.round(top.accuracy * 100);

  if (top.accuracy < 0.4) {
    directives.push(
      `Critical gap in ${top.tag} (${pct}% accuracy). We've added a focused 20-minute review block to today's plan.`
    );
  } else if (top.accuracy < 0.6) {
    directives.push(
      `Your ${top.tag} retention is dropping (${pct}%). A 15-minute targeted session has been scheduled.`
    );
  } else {
    directives.push(
      `${top.tag} needs attention (${pct}% accuracy). A 10-minute reinforcement block is recommended.`
    );
  }

  if (weakestTopics.length >= 2) {
    const second = weakestTopics[1];
    directives.push(
      `Also review ${second.tag} (${Math.round(second.accuracy * 100)}% accuracy) before your next full quiz session.`
    );
  }

  if (overallAccuracy < 0.65) {
    directives.push("Overall accuracy below 65% — prioritise your weakest topics before attempting mixed practice.");
  }

  return directives;
}

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

      // ── Build plain-English diagnostic directives ───────────────────────
      const diagnosticDirectives = buildDiagnosticDirectives(weakestTopics, overallAccuracy);

      // ── Persist ────────────────────────────────────────────────────────
      await db.doc(`users/${uid}/stats/${courseId}`).set(
        {
          totalStudyMinutes,
          totalQuestionsAnswered: totalAnswered,
          overallAccuracy: Math.round(overallAccuracy * 1000) / 1000,
          completionPercent: Math.round(completionPercent * 1000) / 1000,
          weakestTopics,
          diagnosticDirectives,
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
