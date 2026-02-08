const functions = require("firebase-functions");
const admin = require("firebase-admin");
const os = require("os");
const path = require("path");
const fs = require("fs");

const { extractPdfSections } = require("./extractors/pdfExtractor");
const { extractPptxSections } = require("./extractors/pptxExtractor");
const { extractDocxSections } = require("./extractors/docxExtractor");

const db = admin.firestore();

exports.processUploadedFile = functions
  .runWith({ timeoutSeconds: 300, memory: "1GB" })
  .storage.object()
  .onFinalize(async (object) => {
    const filePath = object.name;
    const contentType = object.contentType;

    // Only process supported types
    const supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!supportedTypes.some((t) => contentType.startsWith(t))) {
      console.log(`Unsupported type: ${contentType}. Skipping.`);
      return null;
    }

    // Extract uid and fileId from path: users/{uid}/uploads/{fileId}.ext
    const pathParts = filePath.split("/");
    if (
      pathParts.length < 4 ||
      pathParts[0] !== "users" ||
      pathParts[2] !== "uploads"
    ) {
      console.log("Invalid path structure. Skipping.");
      return null;
    }
    const uid = pathParts[1];
    const fileName = pathParts[3];
    const fileId = path.parse(fileName).name;

    const fileRef = db.doc(`users/${uid}/files/${fileId}`);
    const tempFilePath = path.join(os.tmpdir(), fileName);

    try {
      // Update status
      await fileRef.set(
        {
          status: "PROCESSING",
          processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Download
      const bucket = admin.storage().bucket(object.bucket);
      await bucket.file(filePath).download({ destination: tempFilePath });

      // Extract sections based on content type
      let rawSections = [];

      if (contentType === "application/pdf") {
        rawSections = await extractPdfSections(tempFilePath);
      } else if (
        contentType.includes("presentationml") ||
        contentType.includes("presentation")
      ) {
        rawSections = await extractPptxSections(tempFilePath);
      } else if (
        contentType.includes("wordprocessingml") ||
        contentType.includes("msword")
      ) {
        rawSections = await extractDocxSections(tempFilePath);
      }

      // Upload section text to Cloud Storage and build metadata
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

      // Fetch courseId
      const fileData = (await fileRef.get()).data();
      const courseId = fileData?.courseId || null;

      // Batch write sections (metadata only — text is in Storage)
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

      // Mark file ready
      await fileRef.set(
        {
          status: "READY",
          sectionCount: sections.length,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`Processed ${fileId}: ${sections.length} sections created.`);
    } catch (error) {
      console.error(`Error processing ${fileId}:`, error);
      await fileRef.set(
        {
          status: "FAILED",
          errorMessage: error.message,
        },
        { merge: true }
      );
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }
  });


