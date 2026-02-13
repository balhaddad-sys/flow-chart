/**
 * @module processing/retryFailedSections
 * @description Callable Cloud Function that retries AI processing for
 * failed sections by deleting and re-creating the section documents.
 *
 * Since processSection uses .onCreate(), simply updating aiStatus won't
 * re-trigger it. We must delete the document and create a new one with
 * the same data but aiStatus = PENDING.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const log = require("../lib/logger");

exports.retryFailedSections = functions
  .runWith({
    timeoutSeconds: 60,
    memory: "256MB",
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = context.auth.uid;
    const { fileId } = data;

    if (!fileId) {
      throw new functions.https.HttpsError("invalid-argument", "fileId is required.");
    }

    // Find all FAILED sections for this file
    const sectionsSnap = await db
      .collection(`users/${uid}/sections`)
      .where("fileId", "==", fileId)
      .where("aiStatus", "==", "FAILED")
      .get();

    if (sectionsSnap.empty) {
      return { success: true, data: { retriedCount: 0, message: "No failed sections found." } };
    }

    let retriedCount = 0;

    for (const sectionDoc of sectionsSnap.docs) {
      const sectionData = sectionDoc.data();
      const sectionId = sectionDoc.id;

      try {
        // Delete any existing questions for this section
        const questionsSnap = await db
          .collection(`users/${uid}/questions`)
          .where("sectionId", "==", sectionId)
          .get();

        const batch = db.batch();
        for (const qDoc of questionsSnap.docs) {
          batch.delete(qDoc.ref);
        }

        // Delete the failed section document
        batch.delete(sectionDoc.ref);
        await batch.commit();

        // Re-create with PENDING status (triggers processSection.onCreate)
        await db.collection(`users/${uid}/sections`).doc(sectionId).set({
          fileId: sectionData.fileId,
          courseId: sectionData.courseId,
          title: sectionData.title,
          contentRef: sectionData.contentRef,
          textBlobPath: sectionData.textBlobPath,
          textSizeBytes: sectionData.textSizeBytes,
          estMinutes: sectionData.estMinutes || 30,
          difficulty: sectionData.difficulty || 3,
          topicTags: [],
          aiStatus: "PENDING",
          questionsStatus: "PENDING",
          questionsCount: 0,
          orderIndex: sectionData.orderIndex || 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        retriedCount++;
        log.info("Section re-created for retry", { uid, sectionId, fileId });
      } catch (error) {
        log.error("Failed to retry section", {
          uid,
          sectionId,
          error: error.message,
        });
      }
    }

    return {
      success: true,
      data: {
        retriedCount,
        message: `Retrying ${retriedCount} section(s). Processing will begin shortly.`,
      },
    };
  });
