/**
 * @module assessment/getAssessmentCatalog
 * @description Callable function that returns available assessment topics and
 * supported learning levels for the active course.
 */

const functions = require("firebase-functions");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { ok, safeError } = require("../lib/errors");
const {
  ASSESSMENT_LEVELS,
  ASSESSMENT_TOPIC_LIBRARY,
  normalizeTopicTag,
} = require("./engine");

exports.getAssessmentCatalog = functions.https.onCall(async (data, context) => {
  const uid = requireAuth(context);
  requireStrings(data, [{ field: "courseId", maxLen: 128 }]);
  const { courseId } = data;

  await checkRateLimit(uid, "getAssessmentCatalog", RATE_LIMITS.getAssessmentCatalog);

  try {
    const questionSnap = await db
      .collection(`users/${uid}/questions`)
      .where("courseId", "==", courseId)
      .limit(500)
      .get();

    const tagCounts = new Map();
    const rawSamples = new Map();
    for (const doc of questionSnap.docs) {
      const tags = doc.data().topicTags;
      if (!Array.isArray(tags)) continue;
      for (const rawTag of tags) {
        const raw = String(rawTag || "").trim();
        const tag = normalizeTopicTag(raw);
        if (!tag) continue;
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        if (!rawSamples.has(tag) && raw) {
          rawSamples.set(tag, raw);
        }
      }
    }

    const libraryMap = new Map(
      ASSESSMENT_TOPIC_LIBRARY.map((topic) => [normalizeTopicTag(topic.id), topic])
    );

    const mergedTopics = [];
    for (const topic of ASSESSMENT_TOPIC_LIBRARY) {
      const topicId = normalizeTopicTag(topic.id);
      mergedTopics.push({
        id: rawSamples.get(topicId) || topicId,
        label: topic.label,
        description: topic.description,
        availableQuestions: tagCounts.get(topicId) || 0,
      });
    }

    for (const [tag, count] of tagCounts.entries()) {
      if (libraryMap.has(tag)) continue;
      mergedTopics.push({
        id: rawSamples.get(tag) || tag,
        label: (rawSamples.get(tag) || tag)
          .replace(/-/g, " ")
          .replace(/\b\w/g, (m) => m.toUpperCase()),
        description: "Topic inferred from your uploaded materials.",
        availableQuestions: count,
      });
    }

    mergedTopics.sort((a, b) => {
      if (b.availableQuestions !== a.availableQuestions) {
        return b.availableQuestions - a.availableQuestions;
      }
      return a.label.localeCompare(b.label);
    });

    const levels = ASSESSMENT_LEVELS.map((level) => ({
      id: level.id,
      label: level.label,
      description: level.description,
      targetDifficulty: { min: level.minDifficulty, max: level.maxDifficulty },
      recommendedDailyMinutes: level.recommendedDailyMinutes,
    }));

    return ok({
      levels,
      topics: mergedTopics,
      defaultLevel: "MD3",
    });
  } catch (error) {
    return safeError(error, "assessment catalog retrieval");
  }
});
