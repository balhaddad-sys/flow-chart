/**
 * @module admin/deleteFile
 * @description Callable function that deletes a file and cascades to its
 * sections, questions, and Cloud Storage object.
 *
 * @param {Object} data
 * @param {string} data.fileId - The file document ID to delete.
 * @returns {{ success: true, data: { deletedSections: number, deletedQuestions: number } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { db, batchDelete } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");

const MAX_IN_FILTER = 30;

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

exports.deleteFile = functions
  .runWith({ timeoutSeconds: 60, memory: "256MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "fileId", maxLen: 128 }]);

    const { fileId } = data;
    const fileRef = db.doc(`users/${uid}/files/${fileId}`);

    try {
      const fileDoc = await fileRef.get();
      if (!fileDoc.exists) return fail(Errors.NOT_FOUND, "File not found.");

      const fileData = fileDoc.data();
      const bucket = admin.storage().bucket();

      // 1. Find all sections belonging to this file
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("fileId", "==", fileId)
        .get();

      const sectionIds = sectionsSnap.docs.map((d) => d.id);
      const sectionData = sectionsSnap.docs.map((d) => d.data() || {});

      // 2. Gather questions with a single fileId query (fast path),
      // then backfill legacy records missing fileId via chunked sectionId IN queries.
      const questionRefMap = new Map();
      const questionsByFileSnap = await db
        .collection(`users/${uid}/questions`)
        .where("fileId", "==", fileId)
        .get();
      for (const doc of questionsByFileSnap.docs) {
        questionRefMap.set(doc.ref.path, doc.ref);
      }

      const coveredSectionIds = new Set(
        questionsByFileSnap.docs
          .map((d) => d.data()?.sectionId)
          .filter((id) => typeof id === "string" && id.length > 0)
      );
      const missingSectionIds = sectionIds.filter((id) => !coveredSectionIds.has(id));
      for (const chunk of chunkArray(missingSectionIds, MAX_IN_FILTER)) {
        const legacySnap = await db
          .collection(`users/${uid}/questions`)
          .where("sectionId", "in", chunk)
          .get();
        for (const doc of legacySnap.docs) {
          questionRefMap.set(doc.ref.path, doc.ref);
        }
      }
      const questionRefs = Array.from(questionRefMap.values());

      // 3. Delete questions
      const deletedQuestions = await batchDelete(questionRefs);

      // 4. Delete sections
      const deletedSections = await batchDelete(sectionsSnap.docs.map((d) => d.ref));

      // 5. Delete derived section text blobs
      const textBlobPaths = sectionData
        .map((s) => s.textBlobPath)
        .filter((p) => typeof p === "string" && p.length > 0);
      if (textBlobPaths.length > 0) {
        await Promise.allSettled(textBlobPaths.map((blobPath) => bucket.file(blobPath).delete()));
      }

      // 6. Delete source storage object
      if (fileData.storagePath) {
        try {
          await bucket.file(fileData.storagePath).delete();
        } catch (storageErr) {
          log.warn("Storage file not found or already deleted", {
            storagePath: fileData.storagePath,
            error: storageErr.message,
          });
        }
      }

      // 7. Delete the file document itself
      await fileRef.delete();

      log.info("File deleted with cascade", {
        uid,
        fileId,
        deletedSections,
        deletedQuestions,
      });

      return ok({ deletedSections, deletedQuestions });
    } catch (error) {
      return safeError(error, "file deletion");
    }
  });
