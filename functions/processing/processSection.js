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
const { db } = require("../lib/firestore");
const log = require("../lib/logger");
const { stripOCRNoise } = require("../lib/sanitize");
const { analyzeSectionBlueprint, blueprintContentCount } = require("../ai/blueprintAnalysis");
const { maybeAutoGenerateSchedule } = require("../scheduling/autoSchedule");

// Only Gemini needed — Claude is deferred to on-demand question generation
const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.processSection = functions
  .runWith({
    timeoutSeconds: 120, // Blueprint-only is much faster than blueprint+questions
    memory: "256MB",
    maxInstances: 30,
    secrets: [geminiApiKey],
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
      const [textResult, fileDoc] = await Promise.all([
        bucket.file(sectionData.textBlobPath).download(),
        db.doc(`users/${uid}/files/${sectionData.fileId}`).get(),
      ]);
      const rawText = textResult[0].toString("utf-8");
      const sectionText = stripOCRNoise(rawText);
      const fileData = fileDoc.exists ? fileDoc.data() : {};

      log.info("Text fetched, starting blueprint generation", {
        uid,
        sectionId,
        rawLength: rawText.length,
        cleanedLength: sectionText.length,
        phase: "BLUEPRINT_ONLY",
      });

      const t0 = Date.now();

      // ── Blueprint only — questions are deferred to on-demand ──────────
      // For large documents (1000+ pages), generating questions at ingestion
      // is wasteful since most sections won't be studied immediately.
      // Blueprint alone enables the planner, triage, and study guide.
      // Questions generate on first practice/quiz visit (zero ingestion cost).
      const blueprintResult = await analyzeSectionBlueprint({
        fileName: fileData.originalName || "Unknown",
        sectionLabel: sectionData.title,
        contentType: fileData.mimeType || "pdf",
        sectionText,
      }).then(
        (value) => ({ status: "fulfilled", value }),
        (reason) => ({ status: "rejected", reason })
      );

      // ── Process blueprint result ──────────────────────────────────────
      const bpOk = blueprintResult.status === "fulfilled" && blueprintResult.value?.success;
      let normalised = null;

      if (bpOk) {
        normalised = blueprintResult.value.normalised;

        // Validate blueprint has actual content — empty arrays mean AI returned garbage
        const bp = normalised.blueprint;
        const hasContent = blueprintContentCount(normalised) > 0;

        if (blueprintResult.value.isNonInstructional || !hasContent) {
          // Empty arrays are legitimate — section may be a title page, TOC,
          // copyright notice, or other non-educational content.  Mark it as
          // ANALYZED (not FAILED) so it doesn't block the parent file.
          log.info("Blueprint normalised but no educational content — marking as non-instructional", {
            uid,
            sectionId,
            source: blueprintResult.value.source,
            degraded: blueprintResult.value.degraded || false,
            durationMs: Date.now() - t0,
          });
          await snap.ref.update({
            aiStatus: "ANALYZED",
            isNonInstructional: true,
            blueprint: normalised.blueprint,
            title: normalised.title || sectionData.title,
            difficulty: 1,
            estMinutes: 0,
            questionsStatus: "SKIPPED",
          });
          await maybeMarkFileReady(uid, sectionData.fileId);
          return null;
        }

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
          contentCounts: {
            objectives: bp.learningObjectives.length,
            concepts: bp.keyConcepts.length,
            highYield: bp.highYieldPoints.length,
            traps: bp.commonTraps.length,
            terms: bp.termsToDefine.length,
          },
          source: blueprintResult.value.source,
          degraded: blueprintResult.value.degraded || false,
          attempts: blueprintResult.value.attempts || [],
          durationMs: Date.now() - t0,
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

      // Questions deferred to on-demand — mark as PENDING so the practice
      // page shows "Generate" instead of "Failed". Questions are created
      // when the user first visits Practice or Quiz for this section.
      await snap.ref.update({
        questionsStatus: "PENDING",
        questionsCount: 0,
      });

      log.info("Section processing complete (blueprint only, questions deferred)", {
        uid,
        sectionId,
        phase: "COMPLETE",
        source: blueprintResult.value?.source || "unknown",
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
          questionsStatus: "FAILED",
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
      // Determine readiness quality: if any section has failed questions,
      // mark as READY_PARTIAL instead of fully READY
      const hasQuestionFailures = siblingsSnap.docs.some((d) => {
        const data = d.data();
        return data.aiStatus === "ANALYZED" && data.questionsStatus === "FAILED";
      });
      const hasAnyQuestions = siblingsSnap.docs.some((d) => (d.data().questionsCount || 0) > 0);
      const analyzedWithContent = siblingsSnap.docs.filter((d) => {
        const data = d.data();
        return data.aiStatus === "ANALYZED" && !data.isNonInstructional;
      });
      const allFailed = analyzedWithContent.length === 0 &&
        siblingsSnap.docs.every((d) => d.data().aiStatus === "FAILED" || d.data().isNonInstructional);

      let fileStatus;
      if (allFailed) {
        fileStatus = "FAILED";
      } else if (hasQuestionFailures || !hasAnyQuestions) {
        fileStatus = "READY_PARTIAL";
      } else {
        fileStatus = "READY";
      }

      const fileRef = db.doc(`users/${uid}/files/${fileId}`);
      await fileRef.set(
        {
          status: fileStatus,
          processingPhase: admin.firestore.FieldValue.delete(),
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      log.info("All sections done, file marked", { uid, fileId, status: fileStatus, hasQuestionFailures });

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
