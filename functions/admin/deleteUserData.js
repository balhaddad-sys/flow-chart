const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * Callable: Full purge of a user's data (GDPR-style).
 * Deletes all Firestore subcollections and Cloud Storage files.
 */
exports.deleteUserData = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be logged in"
      );
    }

    const uid = context.auth.uid;

    try {
      // Delete all files under user's Storage prefix
      const bucket = admin.storage().bucket();
      await bucket.deleteFiles({ prefix: `users/${uid}/` });

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

      for (const sub of subcollections) {
        const snap = await db.collection(`users/${uid}/${sub}`).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      // Delete user document itself
      await db.doc(`users/${uid}`).delete();

      console.log(`All data for user ${uid} has been deleted.`);

      return {
        success: true,
        data: { message: "All user data has been permanently deleted." },
      };
    } catch (error) {
      console.error("deleteUserData error:", error);
      return {
        success: false,
        error: { code: "INTERNAL", message: error.message },
      };
    }
  });
