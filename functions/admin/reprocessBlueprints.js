/**
 * @module admin/reprocessBlueprints
 * @description One-time callable to re-generate blueprints for existing
 * sections that have generic page-range titles (e.g. "Pages 81-90").
 * Updates section titles and blueprint data with the improved prompt.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { db } = require("../lib/firestore");
const { normaliseBlueprint } = require("../lib/serialize");
const { stripOCRNoise } = require("../lib/sanitize");
const { generateBlueprint } = require("../ai/geminiClient");
const { BLUEPRINT_SYSTEM, blueprintUserPrompt } = require("../ai/prompts");

const geminiApiKey = functions.params.defineSecret("GEMINI_API_KEY");

// Matches generic titles like "Pages 1-10", "Slides 5-8", "Section 2", "Untitled".
const GENERIC_TITLE_RE =
  /\b(?:Pages?|Slides?|Section|Chapter|Part)\s*\d+(?:\s*(?:-|–|—|to)\s*\d+)?\b|(?:^|\b)(?:Untitled|Unknown\s+Section)(?:\b|$)/i;

exports.reprocessBlueprints = functions
  .runWith({
    timeoutSeconds: 540,
    memory: "512MB",
    secrets: [geminiApiKey],
  })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const uid = context.auth.uid;
    const { courseId } = data || {};

    // Fetch all analyzed sections (optionally filtered by course)
    let query = db.collection("users").doc(uid).collection("sections")
      .where("aiStatus", "==", "ANALYZED");
    if (courseId) {
      query = query.where("courseId", "==", courseId);
    }

    const snap = await query.get();
    if (snap.empty) {
      return { success: true, updated: 0, message: "No sections to reprocess." };
    }

    // Filter to only sections with generic titles
    const toReprocess = snap.docs.filter((doc) => {
      const title = doc.data().title || "";
      return GENERIC_TITLE_RE.test(title);
    });

    if (toReprocess.length === 0) {
      return { success: true, updated: 0, message: "All sections already have proper titles." };
    }

    let updated = 0;
    let failed = 0;
    const bucket = admin.storage().bucket();

    for (const doc of toReprocess) {
      const sectionData = doc.data();
      try {
        // Fetch raw text
        const [textResult] = await bucket.file(sectionData.textBlobPath).download();
        const sectionText = stripOCRNoise(textResult.toString("utf-8"));

        // Fetch file metadata
        const fileDoc = await db.doc(`users/${uid}/files/${sectionData.fileId}`).get();
        const fileData = fileDoc.exists ? fileDoc.data() : {};

        // Re-generate blueprint with improved prompt
        const result = await generateBlueprint(
          BLUEPRINT_SYSTEM,
          blueprintUserPrompt({
            fileName: fileData.originalName || "Unknown",
            sectionLabel: sectionData.title,
            contentType: fileData.mimeType || "pdf",
            sectionText,
          })
        );

        if (result.success && result.data) {
          const normalised = normaliseBlueprint(result.data);
          const newTitle = normalised.title || sectionData.title;

          // Only update if we got a better title
          if (newTitle && !GENERIC_TITLE_RE.test(newTitle)) {
            await doc.ref.update({
              title: newTitle,
              topicTags: normalised.topicTags,
              blueprint: normalised.blueprint,
            });
            updated++;
            console.log(`Updated: "${sectionData.title}" → "${newTitle}"`);
          } else {
            console.warn(`AI still returned generic title for ${doc.id}: "${newTitle}"`);
            failed++;
          }
        } else {
          console.error(`Blueprint failed for ${doc.id}:`, result.error);
          failed++;
        }
      } catch (err) {
        console.error(`Error reprocessing ${doc.id}:`, err.message);
        failed++;
      }
    }

    return {
      success: true,
      updated,
      failed,
      total: toReprocess.length,
      message: `Reprocessed ${updated}/${toReprocess.length} sections with proper titles.`,
    };
  });
