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
const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");
const { normaliseBlueprint, normaliseQuestion } = require("../lib/serialize");
const { generateBlueprint, generateQuestions: aiGenerateQuestions } = require("../ai/geminiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt, QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

const DEFAULT_QUESTION_COUNT = 8;

// Define the secret so the function can access it
const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.processSection = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes — accommodates 60s rate-limit retries for blueprint + questions
    memory: "512MB",
    maxInstances: 10, // Increased to avoid "no available instance" aborts (now using Gemini, not Anthropic)
    minInstances: 1, // Keep warm to eliminate cold start latency
    secrets: [geminiApiKey], // Grant access to the secret
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
      // ATOMIC LOCK: Use transaction to prevent race conditions
      // If two functions trigger simultaneously, only one will succeed
      const lockSuccess = await db.runTransaction(async (transaction) => {
        const currentSnap = await transaction.get(snap.ref);
        if (!currentSnap.exists || currentSnap.data().aiStatus !== "PENDING") {
          return false; // Another instance already claimed this section
        }
        transaction.update(snap.ref, {
          aiStatus: "PROCESSING",
          processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });

      if (!lockSuccess) {
        log.info("Section already being processed by another instance", { uid, sectionId });
        return null;
      }

      log.info("Section processing started", {
        uid,
        sectionId,
        title: sectionData.title,
        phase: "FETCHING_TEXT",
      });

      // Fetch raw text and file metadata in parallel for speed
      const bucket = admin.storage().bucket();
      const [textResult, fileDoc] = await Promise.all([
        bucket.file(sectionData.textBlobPath).download(),
        db.doc(`users/${uid}/files/${sectionData.fileId}`).get(),
      ]);
      const sectionText = textResult[0].toString("utf-8");
      const fileData = fileDoc.exists ? fileDoc.data() : {};

      log.info("Text fetched, starting blueprint generation", {
        uid,
        sectionId,
        textLength: sectionText.length,
        phase: "GENERATING_BLUEPRINT",
      });

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
        await snap.ref.update({
          aiStatus: "FAILED",
          questionsStatus: "FAILED",
          questionsErrorMessage: result.error || "Blueprint generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await maybeMarkFileReady(uid, sectionData.fileId);
        return null;
      }

      log.info("Blueprint generated", {
        uid,
        sectionId,
        durationMs: Date.now() - t0,
        model: result.model,
        tokens: result.tokensUsed || null,
      });

      // Normalise via serialize module
      const normalised = normaliseBlueprint(result.data);

      await snap.ref.update({
        aiStatus: "ANALYZED",
        questionsStatus: "PENDING", // Initialize questions status
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
      const { easyCount, mediumCount, hardCount } = computeSectionQuestionDifficultyCounts(
        count,
        normalised.difficulty || sectionData.difficulty || 3
      );

      log.info("Starting question generation", {
        uid,
        sectionId,
        count,
        phase: "GENERATING_QUESTIONS",
        distribution: { easy: easyCount, medium: mediumCount, hard: hardCount },
      });

      // Mark question generation as in progress
      await snap.ref.update({
        questionsStatus: "GENERATING",
      });

      const qT0 = Date.now();

      const qResult = await aiGenerateQuestions(
        QUESTIONS_SYSTEM,
        questionsUserPrompt({
          blueprintJSON: normalised.blueprint,
          count,
          easyCount,
          mediumCount,
          hardCount,
          sectionTitle: normalised.title || sectionData.title,
          sourceFileName: fileData.originalName || "Unknown",
        })
      );

      if (!qResult.success || !qResult.data.questions) {
        log.warn("Auto question generation failed", {
          uid,
          sectionId,
          error: qResult.error,
          durationMs: Date.now() - qT0,
        });

        // Mark question generation as failed (blueprint is still valid)
        await snap.ref.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: qResult.error || "Question generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await maybeMarkFileReady(uid, sectionData.fileId);
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
        fileName: fileData.originalName || "Unknown",
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

      // Mark question generation as complete
      await snap.ref.update({
        questionsStatus: "COMPLETED",
        questionsCount: validItems.length,
        questionsErrorMessage: admin.firestore.FieldValue.delete(),
      });

      log.info("Section processing complete", {
        uid,
        sectionId,
        phase: "COMPLETE",
        questionsGenerated: validItems.length,
        questionsSkipped: qResult.data.questions.length - validItems.length,
        totalDurationMs: Date.now() - t0,
      });

      // ── Check if ALL sibling sections are done → mark file READY ──────
      await maybeMarkFileReady(uid, sectionData.fileId);
    } catch (error) {
      log.error("Section processing failed", {
        uid,
        sectionId,
        error: error.message,
        stack: error.stack,
        phase: "UNKNOWN", // Helps identify where failure occurred
      });

      // CRITICAL: Mark section as failed so it doesn't get stuck
      try {
        await snap.ref.update({
          aiStatus: "FAILED",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          errorMessage: error.message?.slice(0, 500) || "AI processing failed",
        });
        // Still check if all siblings are done (file should become READY even with failures)
        await maybeMarkFileReady(uid, sectionData.fileId);
      } catch (updateError) {
        log.error("Failed to update section status to FAILED", {
          uid,
          sectionId,
          updateError: updateError.message,
        });
      }
    }
  });

/**
 * Check if all sections for a file are done processing (ANALYZED or FAILED).
 * If so, mark the parent file as READY.
 */
async function maybeMarkFileReady(uid, fileId) {
  if (!fileId) return;
  try {
    const siblingsSnap = await db
      .collection(`users/${uid}/sections`)
      .where("fileId", "==", fileId)
      .get();

    const allDone = siblingsSnap.docs.every((d) => {
      const s = d.data().aiStatus;
      return s === "ANALYZED" || s === "FAILED";
    });

    if (allDone && !siblingsSnap.empty) {
      await db.doc(`users/${uid}/files/${fileId}`).set(
        {
          status: "READY",
          processingPhase: admin.firestore.FieldValue.delete(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      log.info("All sections done, file marked READY", { uid, fileId });
    }
  } catch (err) {
    log.warn("maybeMarkFileReady failed", { uid, fileId, error: err.message });
  }
}
