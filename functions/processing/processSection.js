/**
 * @module processing/processSection
 * @description Firestore trigger that generates an AI blueprint for newly
 * created section documents whose `aiStatus` is `"PENDING"`.
 *
 * The blueprint enriches each section with learning objectives, key concepts,
 * high-yield points, common traps, terms to define, difficulty, estimated
 * study time, and topic tags — all produced by Claude Haiku.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
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
        console.error(`Blueprint generation failed for section ${sectionId}:`, result.error);
        await snap.ref.update({ aiStatus: "FAILED" });
        return null;
      }

      const blueprint = result.data;

      await snap.ref.update({
        aiStatus: "ANALYZED",
        title: blueprint.title || sectionData.title,
        difficulty: blueprint.difficulty || sectionData.difficulty,
        estMinutes: blueprint.estimated_minutes || sectionData.estMinutes,
        topicTags: blueprint.topic_tags || [],
        blueprint: {
          learningObjectives: blueprint.learning_objectives || [],
          keyConcepts: blueprint.key_concepts || [],
          highYieldPoints: blueprint.high_yield_points || [],
          commonTraps: blueprint.common_traps || [],
          termsToDefine: blueprint.terms_to_define || [],
        },
      });

      console.log(`Section ${sectionId} blueprint generated successfully.`);
    } catch (error) {
      console.error(`Error processing section ${sectionId}:`, error);
      await snap.ref.update({ aiStatus: "FAILED" });
    }
  });
