/**
 * @module processing/processSection
 * @description Firestore trigger that generates an AI blueprint for newly
 * created section documents whose `aiStatus` is `"PENDING"`, then
 * automatically generates questions from the analyzed content.
 *
 * Uses the {@link module:lib/serialize} module to transform the AI response
 * into the Firestore schema.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db, batchSet } = require("../lib/firestore");
const log = require("../lib/logger");
const { normaliseBlueprint, normaliseQuestion } = require("../lib/serialize");
const { generateBlueprint, generateQuestions: aiGenerateQuestions } = require("../ai/aiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt, QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");
const { DIFFICULTY_DISTRIBUTION } = require("../lib/constants");

const DEFAULT_QUESTION_COUNT = 10;

exports.processSection = functions
  .runWith({
    timeoutSeconds: 120, // Reduced: Haiku 4.5 is much faster
    memory: "512MB",
    maxInstances: 10, // Process multiple sections in parallel
  })
  .firestore.document("users/{uid}/sections/{sectionId}")
  .onCreate(async (snap, context) => {
    const { uid, sectionId } = context.params;
    const sectionData = snap.data();

    // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────
    // Only process sections that are explicitly PENDING. This prevents:
    // 1. Re-processing on function retries/replays
    // 2. Processing sections created by other flows
    if (sectionData.aiStatus !== "PENDING") {
      log.debug("Section not pending, skipping AI processing", {
        uid,
        sectionId,
        status: sectionData.aiStatus,
      });
      return null;
    }

    try {
      // Lock the section immediately to prevent concurrent processing
      await snap.ref.update({
        aiStatus: "PROCESSING",
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      log.info("Section processing started", {
        uid,
        sectionId,
        title: sectionData.title,
        phase: "FETCHING_TEXT",
      });

      // Fetch raw text from Cloud Storage
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(sectionData.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      log.info("Text fetched, starting blueprint generation", {
        uid,
        sectionId,
        textLength: sectionText.length,
        phase: "GENERATING_BLUEPRINT",
      });

      // Fetch parent file metadata for prompt context
      const fileDoc = await db.doc(`users/${uid}/files/${sectionData.fileId}`).get();
      const fileData = fileDoc.exists ? fileDoc.data() : {};

      // Generate blueprint via AI (Haiku 4.5 - FAST)
      log.info("Starting blueprint generation", { uid, sectionId, textLength: sectionText.length });
      const t0 = Date.now();

      const result = await generateBlueprint(
        BLUEPRINT_SYSTEM,
        blueprintUserPrompt({
          fileName: fileData.originalName || "Unknown",
          sectionLabel: sectionData.title,
          contentType: fileData.mimeType || "pdf",
          sectionText,
        })
      );

      if (!result.success) {
        log.error("Blueprint generation failed", {
          uid,
          sectionId,
          error: result.error,
          durationMs: Date.now() - t0,
        });
        await snap.ref.update({ aiStatus: "FAILED" });
        return null;
      }

      log.info("Blueprint generated", {
        uid,
        sectionId,
        durationMs: Date.now() - t0,
        model: result.model,
        tokens: result.tokensUsed,
      });

      // Normalise via serialize module
      const normalised = normaliseBlueprint(result.data);

      await snap.ref.update({
        aiStatus: "ANALYZED",
        title: normalised.title || sectionData.title,
        difficulty: normalised.difficulty || sectionData.difficulty,
        estMinutes: normalised.estMinutes || sectionData.estMinutes,
        topicTags: normalised.topicTags,
        blueprint: normalised.blueprint,
      });

      log.info("Section blueprint generated", {
        uid,
        sectionId,
        title: normalised.title,
        phase: "BLUEPRINT_COMPLETE",
      });

      // ── Auto-generate questions from the analyzed section ───────────────
      const courseId = sectionData.courseId;
      const count = DEFAULT_QUESTION_COUNT;
      const easyCount = Math.round(count * DIFFICULTY_DISTRIBUTION.easy);
      const hardCount = Math.round(count * DIFFICULTY_DISTRIBUTION.hard);
      const mediumCount = count - easyCount - hardCount;

      log.info("Starting question generation", {
        uid,
        sectionId,
        count,
        phase: "GENERATING_QUESTIONS",
        distribution: { easy: easyCount, medium: mediumCount, hard: hardCount },
      });
      const qT0 = Date.now();

      const qResult = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({
          blueprintJSON: normalised.blueprint,
          sectionText,
          count,
          easyCount,
          mediumCount,
          hardCount,
        })
      );

      if (!qResult.success || !qResult.data.questions) {
        log.warn("Auto question generation failed", {
          uid,
          sectionId,
          error: qResult.error,
          durationMs: Date.now() - qT0,
        });
        return null; // Blueprint saved; questions can be retried manually
      }

      log.info("Questions generated", {
        uid,
        sectionId,
        count: qResult.data.questions.length,
        durationMs: Date.now() - qT0,
        model: qResult.model,
      });

      const defaults = {
        fileId: sectionData.fileId,
        sectionId,
        sectionTitle: normalised.title || sectionData.title,
        topicTags: normalised.topicTags,
      };

      const validItems = [];
      for (const raw of qResult.data.questions) {
        const q = normaliseQuestion(raw, defaults);
        if (!q) {
          log.warn("Skipping invalid auto question", { sectionId, stem: raw.stem?.slice(0, 80) });
          continue;
        }
        validItems.push({
          ref: db.collection(`users/${uid}/questions`).doc(),
          data: {
            courseId,
            sectionId,
            ...q,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });
      }

      if (validItems.length > 0) {
        await batchSet(validItems);
      }

      log.info("Section processing complete", {
        uid,
        sectionId,
        phase: "COMPLETE",
        questionsGenerated: validItems.length,
        questionsSkipped: qResult.data.questions.length - validItems.length,
        totalDurationMs: Date.now() - t0,
      });
    } catch (error) {
      log.error("Section processing failed", { uid, sectionId, error: error.message });
      await snap.ref.update({ aiStatus: "FAILED" });
    }
  });
