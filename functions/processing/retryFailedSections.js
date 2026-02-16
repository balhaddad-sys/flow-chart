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
const { db, batchSet } = require("../lib/firestore");
const log = require("../lib/logger");
const { computeSectionQuestionDifficultyCounts } = require("../lib/difficulty");
const { normaliseQuestion } = require("../lib/serialize");
const { generateQuestions: aiGenerateQuestions } = require("../ai/geminiClient");
const { QUESTIONS_SYSTEM, questionsUserPrompt } = require("../ai/prompts");

// Define the secret so the function can access it
const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

exports.retryFailedSections = functions
  .runWith({
    timeoutSeconds: 300,
    memory: "512MB",
    secrets: [geminiApiKey],
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

    // Find all FAILED sections for this file (aiStatus or questionsStatus)
    const [aiFailedSnap, qFailedSnap] = await Promise.all([
      db.collection(`users/${uid}/sections`)
        .where("fileId", "==", fileId)
        .where("aiStatus", "==", "FAILED")
        .get(),
      db.collection(`users/${uid}/sections`)
        .where("fileId", "==", fileId)
        .where("questionsStatus", "==", "FAILED")
        .get(),
    ]);

    // Deduplicate (a section could match both queries)
    const sectionMap = new Map();
    for (const doc of aiFailedSnap.docs) sectionMap.set(doc.id, doc);
    for (const doc of qFailedSnap.docs) sectionMap.set(doc.id, doc);

    if (sectionMap.size === 0) {
      return { success: true, data: { retriedCount: 0, message: "No failed sections found." } };
    }

    let retriedCount = 0;

    for (const [sectionId, sectionDoc] of sectionMap) {
      const sectionData = sectionDoc.data();

      try {
        // If only questions failed (blueprint is fine), regenerate questions in-place
        // without re-running the expensive blueprint AI
        if (sectionData.aiStatus === "ANALYZED" && sectionData.questionsStatus === "FAILED") {
          // Delete old questions for this section
          const oldQSnap = await db
            .collection(`users/${uid}/questions`)
            .where("sectionId", "==", sectionId)
            .get();
          if (!oldQSnap.empty) {
            const delBatch = db.batch();
            for (const qDoc of oldQSnap.docs) delBatch.delete(qDoc.ref);
            await delBatch.commit();
          }

          // Mark as generating
          await sectionDoc.ref.update({
            questionsStatus: "GENERATING",
            questionsErrorMessage: admin.firestore.FieldValue.delete(),
          });

          // Generate questions directly from existing blueprint
          const count = 8;
          const { easyCount, mediumCount, hardCount } = computeSectionQuestionDifficultyCounts(
            count,
            sectionData.difficulty || 3
          );

          const fileDoc = await db.doc(`users/${uid}/files/${sectionData.fileId}`).get();
          const fileName = fileDoc.exists ? fileDoc.data().originalName : "Unknown";

          const qResult = await aiGenerateQuestions(
            QUESTIONS_SYSTEM,
            questionsUserPrompt({
              blueprintJSON: sectionData.blueprint,
              count,
              easyCount,
              mediumCount,
              hardCount,
              sectionTitle: sectionData.title,
              sourceFileName: fileName,
            })
          );

          if (!qResult.success || !qResult.data?.questions) {
            await sectionDoc.ref.update({
              questionsStatus: "FAILED",
              questionsErrorMessage: qResult.error || "Question generation failed",
              lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            log.warn("Question-only retry failed", { uid, sectionId, error: qResult.error });
          } else {
            const defaults = {
              fileId: sectionData.fileId,
              fileName,
              sectionId,
              sectionTitle: sectionData.title,
              topicTags: sectionData.topicTags || [],
            };
            const validItems = [];
            for (const raw of qResult.data.questions) {
              const q = normaliseQuestion(raw, defaults);
              if (!q) continue;
              validItems.push({
                ref: db.collection(`users/${uid}/questions`).doc(),
                data: {
                  courseId: sectionData.courseId,
                  sectionId,
                  ...q,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                },
              });
            }
            if (validItems.length > 0) await batchSet(validItems);
            await sectionDoc.ref.update({
              questionsStatus: "COMPLETED",
              questionsCount: validItems.length,
            });
            log.info("Question-only retry succeeded", { uid, sectionId, count: validItems.length });
          }

          retriedCount++;
          continue;
        }

        // Full retry: aiStatus === FAILED
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
