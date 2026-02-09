const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");

const db = admin.firestore();

/**
 * Callable: Full purge of a user's data (GDPR-style).
 * Deletes all Firestore subcollections and Cloud Storage files.
 */
exports.deleteUserData = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);

    await checkRateLimit(uid, "deleteUserData", RATE_LIMITS.deleteUserData);

    try {
      // Delete all files under user's Storage prefix
      const bucket = admin.storage().bucket();
      try {
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      } catch (storageError) {
        console.warn(`Storage deletion warning for ${uid}:`, storageError.message);
      }

      // Delete all Firestore subcollections
      const subcollections = [
        "files",
        "sections",
        "tasks",
        "questions",
        "attempts",
        "stats",
        "jobs",
        "courses",
      ];

      const BATCH_LIMIT = 500;
      for (const sub of subcollections) {
        const snap = await db.collection(`users/${uid}/${sub}`).get();
        if (!snap.empty) {
          for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
            const chunk = snap.docs.slice(i, i + BATCH_LIMIT);
            const batch = db.batch();
            chunk.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
          }
        }
      }

      // Delete user document itself
      await db.doc(`users/${uid}`).delete();

      // Clean up rate limit entries
      try {
        const rateLimitSnap = await db.collection("_rateLimits")
          .where(admin.firestore.FieldPath.documentId(), ">=", `${uid}:`)
          .where(admin.firestore.FieldPath.documentId(), "<", `${uid}:\uf8ff`)
          .get();
        if (!rateLimitSnap.empty) {
          const batch = db.batch();
          rateLimitSnap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      } catch (cleanupError) {
        console.warn("Rate limit cleanup warning:", cleanupError.message);
      }

      console.log(`All data for user ${uid} has been deleted.`);

      return {
        success: true,
        data: { message: "All user data has been permanently deleted." },
      };
    } catch (error) {
      return safeError(error, "user data deletion");
    }
  });
