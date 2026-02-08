const functions = require("firebase-functions");
const admin = require("firebase-admin");
const pdfParse = require("pdf-parse");
const { Storage } = require("@google-cloud/storage");
const os = require("os");
const path = require("path");
const fs = require("fs");

const db = admin.firestore();
const storage = new Storage();

const PAGES_PER_SECTION = 10;
const MIN_CHARS_PER_SECTION = 100;

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
      const bucket = storage.bucket(object.bucket);
      await bucket.file(filePath).download({ destination: tempFilePath });

      let sections = [];

      if (contentType === "application/pdf") {
        sections = await processPdf(tempFilePath, fileId, uid, bucket);
      }
      // TODO(medq): Add PPTX and DOCX handlers

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

async function processPdf(filePath, fileId, uid, bucket) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);

  const totalPages = data.numpages;
  const fullText = data.text;
  const charsPerPage = fullText.length / totalPages;

  const sections = [];
  let startPage = 1;

  while (startPage <= totalPages) {
    const endPage = Math.min(startPage + PAGES_PER_SECTION - 1, totalPages);
    const startChar = Math.floor((startPage - 1) * charsPerPage);
    const endChar = Math.floor(endPage * charsPerPage);
    const text = fullText.slice(startChar, endChar).trim();

    if (text.length >= MIN_CHARS_PER_SECTION) {
      // ALWAYS write text to Cloud Storage — never store inline in Firestore
      const sectionSlug = `${fileId}_p${startPage}-${endPage}`;
      const textBlobPath = `users/${uid}/derived/sections/${sectionSlug}.txt`;
      await bucket.file(textBlobPath).save(text, {
        contentType: "text/plain",
        metadata: {
          fileId,
          startPage: String(startPage),
          endPage: String(endPage),
        },
      });

      sections.push({
        fileId,
        title: `Pages ${startPage}\u2013${endPage}`,
        contentRef: { type: "page", startIndex: startPage, endIndex: endPage },
        textBlobPath: textBlobPath,
        textSizeBytes: Buffer.byteLength(text, "utf8"),
        estMinutes: Math.ceil((endPage - startPage + 1) * 3),
        difficulty: 3,
        topicTags: [],
      });
    }

    startPage = endPage + 1;
  }

  return sections;
}
