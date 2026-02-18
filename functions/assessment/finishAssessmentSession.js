/**
 * @module assessment/finishAssessmentSession
 * @description Callable function that finalizes an assessment session and
 * returns a professional weakness/recommendation report.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { FIRESTORE_GET_ALL_LIMIT } = require("../lib/constants");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { computeWeaknessProfile, buildRecommendationPlan } = require("./engine");

exports.finishAssessmentSession = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "sessionId", maxLen: 128 }]);
  const { sessionId } = data;

  await checkRateLimit(uid, "finishAssessmentSession", RATE_LIMITS.finishAssessmentSession);

  try {
    const sessionRef = db.doc(`users/${uid}/examSessions/${sessionId}`);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) return fail(Errors.NOT_FOUND, "Assessment session not found.");
    const session = sessionDoc.data();

    if (session.status === "COMPLETED" && session.finalReport) {
      return ok(session.finalReport);
    }

    const responsesSnap = await sessionRef.collection("responses").get();
    if (responsesSnap.empty) {
      return fail(Errors.INVALID_ARGUMENT, "No submitted answers found for this assessment.");
    }
    const responses = responsesSnap.docs.map((doc) => doc.data());

    const questionIds = [
      ...new Set(
        responses
          .map((response) => response.questionId)
          .filter((questionId) => typeof questionId === "string" && questionId.length > 0)
      ),
    ];

    const questionMap = new Map();
    for (let i = 0; i < questionIds.length; i += FIRESTORE_GET_ALL_LIMIT) {
      const batchIds = questionIds.slice(i, i + FIRESTORE_GET_ALL_LIMIT);
      const refs = batchIds.map((id) => db.doc(`users/${uid}/questions/${id}`));
      const docs = await db.getAll(...refs);
      for (const doc of docs) {
        if (doc.exists) questionMap.set(doc.id, doc.data());
      }
    }

    const profile = computeWeaknessProfile(responses, questionMap, session.level, {
      focusTopicTag: session.topicTagNormalized || session.topicTag || "",
    });
    const recommendations = buildRecommendationPlan(profile);
    const finalReport = {
      sessionId,
      courseId: session.courseId,
      topicTag: session.topicTag,
      level: session.level,
      answeredCount: profile.answeredCount,
      totalQuestions: session.questionCount || (Array.isArray(session.questionIds) ? session.questionIds.length : profile.answeredCount),
      overallAccuracy: profile.overallAccuracy,
      readinessScore: profile.readinessScore,
      avgTimeSec: profile.avgTimeSec,
      targetTimeSec: profile.targetTimeSec,
      weaknessProfile: profile.topicBreakdown,
      recommendations,
      completedAtISO: new Date().toISOString(),
    };

    const batch = db.batch();
    batch.update(sessionRef, {
      status: "COMPLETED",
      finalReport,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const planRef = db.collection(`users/${uid}/recommendationPlans`).doc();
    batch.set(planRef, {
      type: "ASSESSMENT",
      sessionId,
      courseId: session.courseId,
      topicTag: session.topicTag,
      level: session.level,
      finalReport,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();

    log.info("Assessment session finalized", {
      uid,
      sessionId,
      courseId: session.courseId,
      level: session.level,
      topicTag: session.topicTag,
      readinessScore: profile.readinessScore,
      answeredCount: profile.answeredCount,
    });

    return ok(finalReport);
  } catch (error) {
    return safeError(error, "assessment finalization");
  }
});
