const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

const db = admin.firestore();

/**
 * Callable: Generate SBA questions for a section.
 * Pre-generates 10-20 questions and stores them permanently.
 */
exports.generateQuestions = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;
    const { courseId, sectionId, count = 10 } = data;

    if (!courseId || !sectionId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "courseId and sectionId are required"
      );
    }

    try {
      // Fetch section
      const sectionDoc = await db
        .doc(`users/${uid}/sections/${sectionId}`)
        .get();
      if (!sectionDoc.exists) {
        return {
          success: false,
          error: { code: "NOT_FOUND", message: "Section not found" },
        };
      }
      const section = sectionDoc.data();

      if (!section.blueprint) {
        return {
          success: false,
          error: {
            code: "NOT_ANALYZED",
            message: "Section must be analyzed before generating questions",
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

      // Fetch file info
      const fileDoc = await db
        .doc(`users/${uid}/files/${section.fileId}`)
        .get();
      const fileName = fileDoc.exists
        ? fileDoc.data().originalName
        : "Unknown";

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
            message: "Failed to generate questions",
          },
        };
      }

      // Write questions to Firestore
      const batch = db.batch();
      const questions = result.data.questions;

      for (const q of questions) {
        const ref = db.collection(`users/${uid}/questions`).doc();
        batch.set(ref, {
          courseId,
          sectionId,
          topicTags: q.tags || section.topicTags || [],
          difficulty: q.difficulty || 3,
          type: "SBA",
          stem: q.stem,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: {
            correctWhy: q.explanation.correct_why,
            whyOthersWrong: q.explanation.why_others_wrong,
            keyTakeaway: q.explanation.key_takeaway,
          },
          sourceRef: {
            fileId: section.fileId,
            sectionId,
            label: q.source_ref?.sectionLabel || section.title,
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
      console.error("generateQuestions error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });
