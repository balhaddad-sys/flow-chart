/**
 * @module processing/processFile
 * @description Storage trigger that fires when a file is uploaded to
 * `users/{uid}/uploads/{fileId}.ext`.
 *
 * Pipeline:
 *  1. Validate MIME type against the supported set.
 *  2. Download the file to a temp path.
 *  3. Delegate to the appropriate extractor (PDF / PPTX / DOCX).
 *  4. Upload each extracted section's text blob to Cloud Storage.
 *  5. Create section metadata documents in Firestore (status = PENDING).
 *  6. Mark the originating file document as READY.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const os = require("os");
const path = require("path");
const fs = require("fs");

const { db } = require("../lib/firestore");
const { SUPPORTED_MIME_TYPES } = require("../lib/constants");
const log = require("../lib/logger");
const { extractPdfSections } = require("./extractors/pdfExtractor");
const { extractPptxSections } = require("./extractors/pptxExtractor");
const { extractDocxSections } = require("./extractors/docxExtractor");

exports.processUploadedFile = functions
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
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
      // Mark processing started
      await fileRef.set(
        {
          status: "PROCESSING",
          processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Download to tmp
      const bucket = admin.storage().bucket(object.bucket);
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

      // Upload text blobs & build metadata entries
      const sections = [];
      for (const raw of rawSections) {
        const sectionSlug = `${fileId}_s${sections.length}`;
        const textBlobPath = `users/${uid}/derived/sections/${sectionSlug}.txt`;
        await bucket.file(textBlobPath).save(raw.text, {
          contentType: "text/plain",
          metadata: { fileId },
        });

        sections.push({
          fileId,
          title: raw.title,
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
        });
      }

      // Resolve the parent course
      const fileData = (await fileRef.get()).data();
      const courseId = fileData?.courseId || null;

      // Batch-write section metadata
      const batch = db.batch();
      sections.forEach((sec, i) => {
        const ref = db.collection(`users/${uid}/sections`).doc();
        batch.set(ref, {
          ...sec,
          courseId,
          orderIndex: i,
          aiStatus: "PENDING",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      // Mark file as ready
      await fileRef.set(
        {
          status: "READY",
          sectionCount: sections.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      log.info("File processed", { uid, fileId, sectionCount: sections.length });
    } catch (error) {
      log.error("File processing failed", { uid, fileId, error: error.message });
      await fileRef.set(
        {
          status: "FAILED",
          errorMessage: "Document processing failed. Please re-upload the file.",
        },
        { merge: true }
      );
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
  });
