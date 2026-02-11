/**
 * @module analytics/runFixPlan
 * @description Callable function that generates an AI-powered remediation plan
 * based on the student's weakness data for a given course.
 *
 * Reads the latest weakness stats, sends them to Claude for analysis, and
 * persists the resulting tasks to Firestore.
 *
 * @param {Object} data
 * @param {string} data.courseId - Target course.
 * @returns {{ success: true, data: { summary: string, taskCount: number, priorityTopics: string[] } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchSet } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");
const { generateFixPlan } = require("../ai/aiClient");
const { FIX_PLAN_SYSTEM, fixPlanUserPrompt } = require("../ai/prompts");

// Define the secret so the function can access it
const anthropicApiKey = functions.params.defineSecret("ANTHROPIC_API_KEY");

exports.runFixPlan = functions
  .runWith({
    timeoutSeconds: 60,
    secrets: [anthropicApiKey], // Grant access to the secret
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "courseId", maxLen: 128 }]);

    await checkRateLimit(uid, "runFixPlan", RATE_LIMITS.runFixPlan);

    try {
      const { courseId } = data;

      // ── Fetch course ──────────────────────────────────────────────────
      const courseDoc = await db.doc(`users/${uid}/courses/${courseId}`).get();
      if (!courseDoc.exists) return fail(Errors.NOT_FOUND, "Course not found.");

      // ── Fetch weakness stats ──────────────────────────────────────────
      const statsDoc = await db.doc(`users/${uid}/stats/${courseId}`).get();
      if (!statsDoc.exists || !statsDoc.data().weakestTopics?.length) {
        return fail(Errors.NO_SECTIONS, "No weakness data available yet. Answer more questions first.");
      }

      const stats = statsDoc.data();
      const weaknessData = {
        overallAccuracy: stats.overallAccuracy,
        totalQuestionsAnswered: stats.totalQuestionsAnswered,
        weakestTopics: stats.weakestTopics,
        completionPercent: stats.completionPercent,
      };

      // ── Determine available study time ────────────────────────────────
      const courseData = courseDoc.data();
      const examDate = courseData.examDate?.toDate();
      const now = new Date();
      const daysAvailable = examDate
        ? Math.max(1, Math.ceil((examDate - now) / 86_400_000))
        : 7; // default 7 days if no exam date
      const minutesAvailable = daysAvailable * 60; // ~1hr/day for remediation

      // ── Call AI to generate fix plan ──────────────────────────────────
      const result = await generateFixPlan(
        FIX_PLAN_SYSTEM,
        fixPlanUserPrompt({
          weaknessDataJSON: weaknessData,
          minutesAvailable,
          daysAvailable,
        })
      );

      if (!result.success) {
        log.warn("Fix plan AI call failed", { uid, courseId, error: result.error });
        return fail(Errors.AI_FAILED, "Could not generate a fix plan. Please try again.");
      }

      const plan = result.data?.fix_plan || result.data;
      if (!plan || !Array.isArray(plan.tasks)) {
        log.warn("Fix plan AI returned invalid structure", { uid, courseId });
        return fail(Errors.AI_FAILED, "AI returned an invalid fix plan.");
      }

      // ── Persist fix plan tasks ────────────────────────────────────────
      const fixTasks = plan.tasks.slice(0, 20).map((task) => ({
        ref: db.collection(`users/${uid}/tasks`).doc(),
        data: {
          courseId,
          title: String(task.title || "Review").slice(0, 200),
          type: task.type === "QUESTIONS" ? "QUESTIONS" : "REVIEW",
          topicTag: String(task.topicTag || "").slice(0, 100),
          estMinutes: Math.min(120, Math.max(5, Math.floor(task.estMinutes || 15))),
          status: "TODO",
          isFixPlan: true,
          focus: String(task.focus || "").slice(0, 500),
          dueDate: admin.firestore.Timestamp.fromDate(
            new Date(now.getTime() + (task.dayOffset || 0) * 86_400_000)
          ),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }));

      if (fixTasks.length > 0) {
        await batchSet(fixTasks);
      }

      log.info("Fix plan generated", {
        uid,
        courseId,
        taskCount: fixTasks.length,
        priorityTopics: plan.priority_order?.slice(0, 5),
      });

      return ok({
        summary: String(plan.summary || "Remediation plan created").slice(0, 500),
        taskCount: fixTasks.length,
        priorityTopics: Array.isArray(plan.priority_order) ? plan.priority_order.slice(0, 10) : [],
      });
    } catch (error) {
      return safeError(error, "fix plan generation");
    }
  });
