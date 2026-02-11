const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

const db = admin.firestore();

/**
 * Callable: Generate SBA questions for a section.
 * Pre-generates 10-20 questions and stores them permanently.
 */
exports.generateQuestions = functions
  .runWith({
    timeoutSeconds: 120,
    memory: "512MB",
    secrets: ["ANTHROPIC_API_KEY"],
  })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [
      { field: "courseId", maxLen: 128 },
      { field: "sectionId", maxLen: 128 },
    ]);
    const count = requireInt(data, "count", 1, 30, 10);

    await checkRateLimit(uid, "generateQuestions", RATE_LIMITS.generateQuestions);

    try {
      const { courseId, sectionId } = data;

      // Fetch section
      const sectionDoc = await db
        .doc(`users/${uid}/sections/${sectionId}`)
        .get();
      if (!sectionDoc.exists) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Section not found." },
        };
      }
      const section = sectionDoc.data();

      // Verify section belongs to user's course
      if (section.courseId !== courseId) {
        return {
          success: false,
          error: { code: "INVALID_ARGUMENT", message: "Section does not belong to this course." },
        };
      }

      if (!section.blueprint) {
        return {
          success: false,
          error: {
            code: "NOT_ANALYZED",
            message: "Section must be analyzed before generating questions.",
          },
        };
      }

      // Fetch section text from Storage
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(section.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      // Determine difficulty distribution
      const easyCount = Math.round(count * 0.4);
      const hardCount = Math.round(count * 0.2);
      const mediumCount = count - easyCount - hardCount;

      // Generate questions via AI
      const result = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({
          blueprintJSON: section.blueprint,
          sectionText,
          count,
          easyCount,
          mediumCount,
          hardCount,
        })
      );

      if (!result.success || !result.data.questions) {
        return {
          success: false,
          error: {
            code: "AI_FAILED",
            message: "Failed to generate questions. Please try again.",
          },
        };
      }

      // Write questions to Firestore
      const batch = db.batch();
      const questions = result.data.questions;

      for (const q of questions) {
        // Validate question structure before writing
        if (!q.stem || !Array.isArray(q.options) || q.correct_index == null) {
          continue;
        }

        const ref = db.collection(`users/${uid}/questions`).doc();
        batch.set(ref, {
          courseId,
          sectionId,
          topicTags: Array.isArray(q.tags) ? q.tags.slice(0, 10) : (section.topicTags || []),
          difficulty: Math.min(5, Math.max(1, q.difficulty || 3)),
          type: "SBA",
          stem: String(q.stem).slice(0, 2000),
          options: q.options.slice(0, 8).map((o) => String(o).slice(0, 500)),
          correctIndex: Math.min(q.options.length - 1, Math.max(0, q.correct_index)),
          explanation: {
            correctWhy: String(q.explanation?.correct_why || "").slice(0, 1000),
            whyOthersWrong: String(q.explanation?.why_others_wrong || "").slice(0, 2000),
            keyTakeaway: String(q.explanation?.key_takeaway || "").slice(0, 500),
          },
          sourceRef: {
            fileId: section.fileId,
            sectionId,
            label: String(q.source_ref?.sectionLabel || section.title).slice(0, 200),
          },
          stats: { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      return {
        success: true,
        data: { questionCount: questions.length },
      };
    } catch (error) {
      return safeError(error, "question generation");
    }
  });
