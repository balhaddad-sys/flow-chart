const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Storage } = require("@google-cloud/storage");
const { generateBlueprint } = require("../ai/aiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt } = require("../ai/prompts");

const db = admin.firestore();
const storage = new Storage();

/**
 * Firestore trigger: when a new section is created with aiStatus === "PENDING",
 * fetch its text from Storage and generate a blueprint via AI.
 */
exports.processSection = functions
  .runWith({ timeoutSeconds: 120, memory: "512MB" })
  .firestore.document("users/{uid}/sections/{sectionId}")
  .onCreate(async (snap, context) => {
    const { uid, sectionId } = context.params;
    const sectionData = snap.data();

    if (sectionData.aiStatus !== "PENDING") return null;

    try {
      // Fetch section text from Storage
      const bucket = admin.storage().bucket();
      const [buffer] = await bucket.file(sectionData.textBlobPath).download();
      const sectionText = buffer.toString("utf-8");

      // Fetch file info for context
      const fileDoc = await db
        .doc(`users/${uid}/files/${sectionData.fileId}`)
        .get();
      const fileData = fileDoc.exists ? fileDoc.data() : {};

      // Generate blueprint
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

      // Update section with blueprint data
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
