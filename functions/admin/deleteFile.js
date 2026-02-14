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

      // 1. Find all sections belonging to this file
      const sectionsSnap = await db
        .collection(`users/${uid}/sections`)
        .where("fileId", "==", fileId)
        .get();

      const sectionIds = sectionsSnap.docs.map((d) => d.id);

      // 2. Find all questions belonging to those sections
      let questionRefs = [];
      for (const sectionId of sectionIds) {
        const questionsSnap = await db
          .collection(`users/${uid}/questions`)
          .where("sectionId", "==", sectionId)
          .get();
        questionRefs = questionRefs.concat(questionsSnap.docs.map((d) => d.ref));
      }

      // 3. Delete questions
      const deletedQuestions = await batchDelete(questionRefs);

      // 4. Delete sections
      const deletedSections = await batchDelete(sectionsSnap.docs.map((d) => d.ref));

      // 5. Delete storage object
      if (fileData.storagePath) {
        try {
          await admin.storage().bucket().file(fileData.storagePath).delete();
        } catch (storageErr) {
          log.warn("Storage file not found or already deleted", {
            storagePath: fileData.storagePath,
            error: storageErr.message,
          });
        }
      }

      // 6. Delete the file document itself
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
