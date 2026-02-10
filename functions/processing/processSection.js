/**
 * @module processing/processSection
 * @description Firestore trigger that generates an AI blueprint for newly
 * created section documents whose `aiStatus` is `"PENDING"`.
 *
 * Uses the {@link module:lib/serialize} module to transform the AI response
 * into the Firestore schema.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const log = require("../lib/logger");
const { normaliseBlueprint } = require("../lib/serialize");
const { generateBlueprint } = require("../ai/aiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt } = require("../ai/prompts");

exports.processSection = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .firestore.document("users/{uid}/sections/{sectionId}")
  .onCreate(async (snap, context) => {
    const { uid, sectionId } = context.params;
    const sectionData = snap.data();

    if (sectionData.aiStatus !== "PENDING") return null;

    try {
      // Fetch raw text from Cloud Storage
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(sectionData.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      // Fetch parent file metadata for prompt context
      const fileDoc = await db.doc(`users/${uid}/files/${sectionData.fileId}`).get();
      const fileData = fileDoc.exists ? fileDoc.data() : {};

      // Generate blueprint via AI
      const result = await generateBlueprint(
        BLUEPRINT_SYSTEM,
        blueprintUserPrompt({
          fileName: fileData.originalName || "Unknown",
          sectionLabel: sectionData.title,
          contentType: fileData.mimeType || "pdf",
          sectionText,
        })
      );

      if (!result.success) {
        log.error("Blueprint generation failed", { uid, sectionId, error: result.error });
        await snap.ref.update({ aiStatus: "FAILED" });
        return null;
      }

      // Normalise via serialize module
      const normalised = normaliseBlueprint(result.data);

      await snap.ref.update({
        aiStatus: "ANALYZED",
        title: normalised.title || sectionData.title,
        difficulty: normalised.difficulty || sectionData.difficulty,
        estMinutes: normalised.estMinutes || sectionData.estMinutes,
        topicTags: normalised.topicTags,
        blueprint: normalised.blueprint,
      });

      log.info("Section blueprint generated", { uid, sectionId, title: normalised.title });
    } catch (error) {
      log.error("Section processing failed", { uid, sectionId, error: error.message });
      await snap.ref.update({ aiStatus: "FAILED" });
    }
  });
