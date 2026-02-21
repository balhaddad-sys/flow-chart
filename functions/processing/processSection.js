/**
 * @module processing/processSection
 * @description Firestore trigger that generates an AI blueprint and exam
 * questions **in parallel** for newly created section documents whose
 * `aiStatus` is `"PENDING"`.
 *
 * Both AI calls run concurrently via Promise.allSettled — the blueprint
 * analyses the text structure while questions are generated directly from
 * the raw text. Each can fail independently; a failed question generation
 * does not block the blueprint from being saved (and can be retried later).
 *
 * Uses the {@link module:lib/serialize} module to transform AI responses
 * into the Firestore schema.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db, batchSet } = require("../lib/firestore");
const log = require("../lib/logger");
const { DEFAULT_QUESTION_COUNT } = require("../lib/constants");
const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");
const { normaliseBlueprint, normaliseQuestion } = require("../lib/serialize");
const { stripOCRNoise } = require("../lib/sanitize");
const { generateBlueprint, generateQuestions: aiGenerateQuestions } = require("../ai/geminiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt, QUESTIONS_FROM_TEXT_SYSTEM, questionsFromTextUserPrompt } = require("../ai/prompts");
const { maybeAutoGenerateSchedule } = require("../scheduling/autoSchedule");

// Define the secret so the function can access it
const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.processSection = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutes — parallel AI calls finish faster; still covers rate-limit retries
    memory: "512MB",
    maxInstances: 20, // Higher concurrency safe with parallel calls (each instance finishes faster)
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

      const courseId = sectionData.courseId;
      if (!courseId) {
        throw new Error("Section is missing courseId; cannot resolve exam profile.");
      }

      // Fetch raw text, file metadata, and course in parallel
      const bucket = admin.storage().bucket();
      const [textResult, fileDoc, courseDoc] = await Promise.all([
        bucket.file(sectionData.textBlobPath).download(),
        db.doc(`users/${uid}/files/${sectionData.fileId}`).get(),
        db.doc(`users/${uid}/courses/${courseId}`).get(),
      ]);
      const rawText = textResult[0].toString("utf-8");
      const sectionText = stripOCRNoise(rawText);
      const fileData = fileDoc.exists ? fileDoc.data() : {};
      const examType = (courseDoc.exists ? courseDoc.data()?.examType : null) || "SBA";

      const count = DEFAULT_QUESTION_COUNT;
      // Use default difficulty (3) for distribution since blueprint hasn't run yet
      const { easyCount, mediumCount, hardCount } = computeSectionQuestionDifficultyCounts(
        count,
        sectionData.difficulty || 3
      );

      log.info("Text fetched, starting parallel AI generation", {
        uid,
        sectionId,
        rawLength: rawText.length,
        cleanedLength: sectionText.length,
        phase: "GENERATING_PARALLEL",
      });

      const t0 = Date.now();

      // ── Run blueprint + questions in PARALLEL ─────────────────────────
      // Both calls work from the raw section text independently.
      // Promise.allSettled lets each succeed or fail on its own.
      const [blueprintResult, questionsResult] = await Promise.allSettled([
        generateBlueprint(
          BLUEPRINT_SYSTEM,
          blueprintUserPrompt({
            fileName: fileData.originalName || "Unknown",
            sectionLabel: sectionData.title,
            contentType: fileData.mimeType || "pdf",
            sectionText,
          })
        ),
        aiGenerateQuestions(
          QUESTIONS_FROM_TEXT_SYSTEM,
          questionsFromTextUserPrompt({
            sectionText,
            count,
            easyCount,
            mediumCount,
            hardCount,
            sectionTitle: sectionData.title,
            sourceFileName: fileData.originalName || "Unknown",
            examType,
          })
        ),
      ]);

      // ── Process blueprint result ──────────────────────────────────────
      const bpOk = blueprintResult.status === "fulfilled" && blueprintResult.value.success;
      let normalised = null;

      if (bpOk) {
        normalised = normaliseBlueprint(blueprintResult.value.data);
        await snap.ref.update({
          aiStatus: "ANALYZED",
          title: normalised.title || sectionData.title,
          difficulty: normalised.difficulty || sectionData.difficulty,
          estMinutes: normalised.estMinutes || sectionData.estMinutes,
          topicTags: normalised.topicTags,
          blueprint: normalised.blueprint,
        });
        log.info("Blueprint generated", {
          uid,
          sectionId,
          durationMs: Date.now() - t0,
          model: blueprintResult.value.model,
          tokens: blueprintResult.value.tokensUsed || null,
        });
      } else {
        const bpError = blueprintResult.status === "fulfilled"
          ? blueprintResult.value.error
          : blueprintResult.reason?.message;
        log.error("Blueprint generation failed", { uid, sectionId, error: bpError, durationMs: Date.now() - t0 });
        await snap.ref.update({
          aiStatus: "FAILED",
          questionsStatus: "FAILED",
          questionsErrorMessage: bpError || "Blueprint generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await maybeMarkFileReady(uid, sectionData.fileId);
        return null;
      }

      // ── Process questions result ──────────────────────────────────────
      const qResult = questionsResult.status === "fulfilled" ? questionsResult.value : null;
      const qOk = qResult?.success && qResult?.data?.questions;

      if (!qOk) {
        const qError = questionsResult.status === "fulfilled"
          ? qResult?.error
          : questionsResult.reason?.message;
        log.warn("Question generation failed", { uid, sectionId, error: qError, durationMs: Date.now() - t0 });
        await snap.ref.update({
          questionsStatus: "FAILED",
          questionsErrorMessage: qError || "Question generation failed",
          lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await maybeMarkFileReady(uid, sectionData.fileId);
        return null; // Blueprint saved; questions can be retried manually
      }

      log.info("Questions generated", {
        uid,
        sectionId,
        count: qResult.data.questions.length,
        durationMs: Date.now() - t0,
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
      const fileRef = db.doc(`users/${uid}/files/${fileId}`);
      await fileRef.set(
        {
          status: "READY",
          processingPhase: admin.firestore.FieldValue.delete(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      log.info("All sections done, file marked READY", { uid, fileId });

      // Auto-generate study plan if all course files are done and no plan exists yet
      const fileData = (await fileRef.get()).data();
      if (fileData?.courseId) {
        await maybeAutoGenerateSchedule(uid, fileData.courseId);
      }
    }
  } catch (err) {
    log.warn("maybeMarkFileReady failed", { uid, fileId, error: err.message });
  }
}
