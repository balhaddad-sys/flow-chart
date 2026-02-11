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
      // Fetch courseId and mark processing started in parallel
      const bucket = admin.storage().bucket(object.bucket);
      const [fileSnap] = await Promise.all([
        fileRef.get(),
        fileRef.set(
          {
            status: "PROCESSING",
            processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ]);
      const courseId = fileSnap.data()?.courseId || null;

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

      // Upload all text blobs in parallel & build metadata entries
      const sections = await Promise.all(
        rawSections.map(async (raw, idx) => {
          const sectionSlug = `${fileId}_s${idx}`;
          const textBlobPath = `users/${uid}/derived/sections/${sectionSlug}.txt`;
          await bucket.file(textBlobPath).save(raw.text, {
            contentType: "text/plain",
            metadata: { fileId },
          });

          return {
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
          };
        })
      );

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
