/**
 * @module questions/generateQuestions
 * @description Callable function that generates exam-style single-best-answer
 * (SBA) questions for a given course section via Claude Haiku.
 *
 * Questions are pre-generated in bulk (default 10, max 30), validated for
 * structural correctness, and persisted to Firestore with initial stats.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings, requireInt, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchSet } = require("../lib/firestore");
const { DIFFICULTY_DISTRIBUTION } = require("../lib/constants");
const { truncate } = require("../lib/utils");
const { generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

exports.generateQuestions = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
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

      // ── Fetch & validate section ────────────────────────────────────────
      const sectionDoc = await db.doc(`users/${uid}/sections/${sectionId}`).get();
      if (!sectionDoc.exists) {
        return { success: false, error: { code: "NOT_FOUND", message: "Section not found." } };
      }
      const section = sectionDoc.data();

      if (section.courseId !== courseId) {
        return { success: false, error: { code: "INVALID_ARGUMENT", message: "Section does not belong to this course." } };
      }
      if (!section.blueprint) {
        return { success: false, error: { code: "NOT_ANALYZED", message: "Section must be analyzed before generating questions." } };
      }

      // ── Fetch section text from Storage ─────────────────────────────────
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(section.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      // ── Difficulty distribution ─────────────────────────────────────────
      const easyCount = Math.round(count * DIFFICULTY_DISTRIBUTION.easy);
      const hardCount = Math.round(count * DIFFICULTY_DISTRIBUTION.hard);
      const mediumCount = count - easyCount - hardCount;

      // ── AI generation ───────────────────────────────────────────────────
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
        return { success: false, error: { code: "AI_FAILED", message: "Failed to generate questions. Please try again." } };
      }

      // ── Validate & persist ──────────────────────────────────────────────
      const questions = result.data.questions;
      const validItems = [];

      for (const q of questions) {
        if (!q.stem || !Array.isArray(q.options) || q.correct_index == null) {
          console.warn("Skipping invalid question: missing stem, options, or correct_index");
          continue;
        }

        validItems.push({
          ref: db.collection(`users/${uid}/questions`).doc(),
          data: {
            courseId,
            sectionId,
            topicTags: Array.isArray(q.tags) ? q.tags.slice(0, 10) : (section.topicTags || []),
            difficulty: Math.min(5, Math.max(1, q.difficulty || 3)),
            type: "SBA",
            stem: truncate(q.stem, 2000),
            options: q.options.slice(0, 8).map((o) => truncate(o, 500)),
            correctIndex: Math.min(q.options.length - 1, Math.max(0, q.correct_index)),
            explanation: {
              correctWhy: truncate(q.explanation?.correct_why, 1000),
              whyOthersWrong: truncate(q.explanation?.why_others_wrong, 2000),
              keyTakeaway: truncate(q.explanation?.key_takeaway, 500),
            },
            sourceRef: {
              fileId: section.fileId,
              sectionId,
              label: truncate(q.source_ref?.sectionLabel || section.title, 200),
            },
            stats: { timesAnswered: 0, timesCorrect: 0, avgTimeSec: 0 },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      }

      await batchSet(validItems);

      return {
        success: true,
        data: { questionCount: validItems.length, skippedCount: questions.length - validItems.length },
      };
    } catch (error) {
      return safeError(error, "question generation");
    }
  });
