/**
 * @module processing/processFile
 * @description Storage trigger that fires when a file is uploaded to
 * `users/{uid}/uploads/{fileId}.ext`.
 *
 * Pipeline:
 *  1. Validate MIME type against the supported set.
 *  2. Download the file to a temp path.
 *  3. Delegate to the appropriate extractor (PDF / PPTX / DOCX).
 *  4. Upload extracted section text blobs to Cloud Storage in parallel.
 *  5. Create section metadata documents in Firestore (status = PENDING).
 *  6. Mark the originating file document as READY.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const os = require("os");
const path = require("path");
const fs = require("fs");

const { db, batchSet } = require("../lib/firestore");
const { SUPPORTED_MIME_TYPES, INGESTION_STEP_LABELS } = require("../lib/constants");

/** Emit a real-time progress update to the file document. */
async function setProgress(fileRef, status, progress) {
  await fileRef.set(
    {
      status,
      progress,
      stepLabel: INGESTION_STEP_LABELS[status] || status,
      progressUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
const log = require("../lib/logger");
const { extractPdfSections } = require("./extractors/pdfExtractor");
const { extractPptxSections } = require("./extractors/pptxExtractor");
const { extractDocxSections } = require("./extractors/docxExtractor");
const { filterAnalyzableSections } = require("./filters/sectionFilter");

exports.processUploadedFile = functions
  .runWith({
    timeoutSeconds: 120, // Extraction is fast; AI processing is async via triggers
    memory: "1GB",
    minInstances: 1, // Keep one warm instance to eliminate cold starts
  })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;

    // ── Guard: only handle supported document types ──────────────────────
    if (!SUPPORTED_MIME_TYPES.some((t) => contentType.startsWith(t))) {
      log.debug("Unsupported file type, skipping", { contentType, filePath });
      return null;
    }

    // ── Parse storage path: users/{uid}/uploads/{fileId}.ext ─────────────
    const pathParts = filePath.split("/");
    if (pathParts.length < 4 || pathParts[0] !== "users" || pathParts[2] !== "uploads") {
      log.warn("Invalid upload path structure, skipping", { filePath });
      return null;
    }

    const uid = pathParts[1];
    const fileName = pathParts[3];
    const fileId = path.parse(fileName).name;
    const fileRef = db.doc(`users/${uid}/files/${fileId}`);
    const tempFilePath = path.join(os.tmpdir(), fileName);

    try {
      const bucket = admin.storage().bucket(object.bucket);

      // ── IDEMPOTENCY GUARD ────────────────────────────────────────────────
      // Cloud Functions guarantees "at-least-once" execution. This prevents
      // double-billing and data corruption on retries/replays.
      const fileSnap = await fileRef.get();
      if (!fileSnap.exists) {
        log.warn("File metadata missing, cannot process upload", { uid, fileId, filePath });
        return null;
      }
      const fileMeta = fileSnap.data() || {};

      const currentStatus = fileMeta.status;

      if (currentStatus === "READY" || currentStatus === "PROCESSING") {
        log.info("File already processed or in progress, skipping", {
          uid,
          fileId,
          status: currentStatus,
        });
        return null;
      }

      // Mark processing started & fetch courseId
      await fileRef.set(
        {
          status: "parsing",
          processingPhase: "EXTRACTING",
          progress: 5,
          stepLabel: INGESTION_STEP_LABELS["parsing"],
          readyQuestionCount: 0,
          totalQuestionTarget: 0,
          processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const courseId = fileMeta.courseId;
      if (!courseId) {
        throw new Error("File is missing courseId; cannot create sections.");
      }
      const sourceLabel = (fileMeta.originalName || fileName || "Document").replace(/\.[^/.]+$/, "");

      log.info("Starting document extraction", { uid, fileId, contentType });
      await setProgress(fileRef, "chunking", 20);

      // Download to tmp
      await bucket.file(filePath).download({ destination: tempFilePath });

      // Extract raw sections via the appropriate extractor
      let rawSections = [];
      if (contentType === "application/pdf") {
        rawSections = await extractPdfSections(tempFilePath);
      } else if (contentType.includes("presentationml") || contentType.includes("presentation")) {
        rawSections = await extractPptxSections(tempFilePath);
      } else if (contentType.includes("wordprocessingml") || contentType.includes("msword")) {
        rawSections = await extractDocxSections(tempFilePath);
      }

      const { keptSections, droppedSections } = filterAnalyzableSections(rawSections);
      if (droppedSections.length > 0) {
        log.info("Filtered non-instructional sections", {
          uid,
          fileId,
          droppedCount: droppedSections.length,
          dropped: droppedSections.slice(0, 8),
        });
      }

      // Upload all text blobs in parallel & build metadata entries
      const sections = await Promise.all(
        keptSections.map(async (raw, idx) => {
          const sectionSlug = `${fileId}_s${idx}`;
          const textBlobPath = `users/${uid}/derived/sections/${sectionSlug}.txt`;
          await bucket.file(textBlobPath).save(raw.text, {
            contentType: "text/plain",
            metadata: { fileId },
          });

          return {
            fileId,
            // Prefix with source label to prevent ambiguous "Pages 1-10" section names across files.
            title: `${sourceLabel}: ${raw.title}`,
            contentRef: {
              type: raw.startPage != null ? "page" : raw.startSlide != null ? "slide" : "word",
              startIndex: raw.startPage || raw.startSlide || raw.startWord || 0,
              endIndex: raw.endPage || raw.endSlide || raw.endWord || 0,
            },
            textBlobPath,
            textSizeBytes: Buffer.byteLength(raw.text, "utf8"),
            estMinutes: raw.estMinutes || 15,
            difficulty: 3,
            topicTags: [],
          };
        })
      );

      if (sections.length === 0) {
        log.warn("No readable text extracted from file", { uid, fileId, contentType });
        const allDroppedAsNonInstructional = droppedSections.length > 0 && keptSections.length === 0;
        await fileRef.set(
          {
            status: "FAILED",
            processingPhase: admin.firestore.FieldValue.delete(),
            sectionCount: 0,
            errorMessage: allDroppedAsNonInstructional
              ? "Only editorial or non-instructional pages were detected. Upload core medical content pages."
              : "No readable text was found in this document. If this is a scanned file, run OCR first and upload again.",
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        return null;
      }

      // Update phase: moving to AI analysis
      await setProgress(fileRef, "indexing", 55);

      // Batch-write section metadata (handles >500 docs automatically)
      const items = sections.map((sec, i) => ({
        ref: db.collection(`users/${uid}/sections`).doc(),
        data: {
          ...sec,
          courseId,
          orderIndex: i,
          aiStatus: "PENDING",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }));
      await batchSet(items);

      log.info("Extraction complete, AI analysis will begin", { uid, fileId, sectionCount: sections.length });

      // Keep file in PROCESSING/ANALYZING status — processSection will
      // update to READY once ALL sections finish AI processing.
      await fileRef.set(
        {
          status: "PROCESSING",
          processingPhase: "ANALYZING",
          sectionCount: sections.length,
        },
        { merge: true }
      );

      // Transition to question generation phase
      await fileRef.set(
        {
          status: "generating_questions",
          processingPhase: "ANALYZING",
          progress: 70,
          stepLabel: INGESTION_STEP_LABELS["generating_questions"],
          sectionCount: sections.length,
          totalQuestionTarget: sections.length * 10,
        },
        { merge: true }
      );
      log.info("File sections created, awaiting AI analysis", { uid, fileId, sectionCount: sections.length });
    } catch (error) {
      log.error("File processing failed", {
        uid,
        fileId,
        error: error.message,
        stack: error.stack,
        contentType,
      });

      // CRITICAL: Clear processing phase and mark as failed
      // This ensures the UI doesn't show stuck "Analyzing..." messages
      try {
        await fileRef.set(
          {
            status: "FAILED",
            processingPhase: admin.firestore.FieldValue.delete(),
            errorMessage: "Document processing failed. Please re-upload the file.",
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (updateError) {
        log.error("Failed to update file status to FAILED", {
          uid,
          fileId,
          updateError: updateError.message,
        });
      }
    } finally {
      // CLEANUP: Always remove temp file, even if status update fails
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          log.debug("Temp file cleaned up", { uid, fileId, tempFilePath });
        }
      } catch (cleanupError) {
        log.warn("Failed to cleanup temp file", {
          uid,
          fileId,
          tempFilePath,
          cleanupError: cleanupError.message,
        });
      }
    }
  });
