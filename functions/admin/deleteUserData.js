/**
 * @module admin/deleteUserData
 * @description Callable function for GDPR-style full purge of a user's data.
 *
 * Deletes every Firestore sub-collection under the user document, all Cloud
 * Storage files under the user's prefix, rate-limit tracking entries, and
 * the user document itself.  Designed to be idempotent — partial failures
 * (e.g. Storage network errors) are logged but do not abort the operation.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, safeError } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db, batchDelete } = require("../lib/firestore");
const { USER_SUBCOLLECTIONS } = require("../lib/constants");

exports.deleteUserData = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);

    await checkRateLimit(uid, "deleteUserData", RATE_LIMITS.deleteUserData);

    try {
      // ── Delete Cloud Storage files ──────────────────────────────────────
      const bucket = admin.storage().bucket();
      try {
        await bucket.deleteFiles({ prefix: `users/${uid}/` });
      } catch (storageError) {
        console.warn(`Storage deletion warning for ${uid}:`, storageError.message);
      }

      // ── Delete Firestore sub-collections ────────────────────────────────
      for (const sub of USER_SUBCOLLECTIONS) {
        const snap = await db.collection(`users/${uid}/${sub}`).get();
        if (!snap.empty) {
          await batchDelete(snap.docs.map((doc) => doc.ref));
        }
      }

      // ── Delete user document ────────────────────────────────────────────
      await db.doc(`users/${uid}`).delete();

      // ── Clean up rate-limit entries ─────────────────────────────────────
      try {
        const rateLimitSnap = await db
          .collection("_rateLimits")
          .where(admin.firestore.FieldPath.documentId(), ">=", `${uid}:`)
          .where(admin.firestore.FieldPath.documentId(), "<", `${uid}:\uf8ff`)
          .get();
        if (!rateLimitSnap.empty) {
          await batchDelete(rateLimitSnap.docs.map((doc) => doc.ref));
        }
      } catch (cleanupError) {
        console.warn("Rate limit cleanup warning:", cleanupError.message);
      }

      console.log(`All data for user ${uid} has been deleted.`);

      return { success: true, data: { message: "All user data has been permanently deleted." } };
    } catch (error) {
      return safeError(error, "user data deletion");
    }
  });
