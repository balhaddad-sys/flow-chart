const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { generateFixPlan } = require("../ai/aiClient");
const { FIX_PLAN_SYSTEM, fixPlanUserPrompt } = require("../ai/prompts");

const db = admin.firestore();

/**
 * Callable: Generate a remediation fix plan from weakness stats.
 */
exports.runFixPlan = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "512MB",
    secrets: ["ANTHROPIC_API_KEY"],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "runFixPlan", RATE_LIMITS.runFixPlan);

    try {
      const { courseId } = data;

      const [statsDoc, userDoc] = await Promise.all([
        db.doc(`users/${uid}/stats/${courseId}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);

      if (!statsDoc.exists) {
        return {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "No stats found for this course yet. Complete some questions first.",
          },
        };
      }

      const stats = statsDoc.data() || {};
      const weakestTopics = Array.isArray(stats.weakestTopics) ? stats.weakestTopics : [];
      if (weakestTopics.length === 0) {
        return {
          success: false,
          error: {
            code: "NOT_ENOUGH_DATA",
            message: "No weak topics found yet. Complete more quizzes first.",
          },
        };
      }

      const prefs = userDoc.exists ? (userDoc.data()?.preferences || {}) : {};
      const minutesAvailable = Number(prefs.dailyMinutesDefault || 120) * 3;
      const daysAvailable = 3;

      const result = await generateFixPlan(
        FIX_PLAN_SYSTEM,
        fixPlanUserPrompt({
          weaknessDataJSON: {
            courseId,
            overallAccuracy: stats.overallAccuracy || 0,
            weakestTopics,
          },
          minutesAvailable,
          daysAvailable,
        })
      );

      if (!result.success || !result.data?.fix_plan) {
        return {
          success: false,
          error: {
            code: "AI_FAILED",
            message: "Failed to generate fix plan. Please try again.",
          },
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      return safeError(error, "fix plan generation");
    }
  });
