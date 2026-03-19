/**
 * @module groups/joinGroupByInvite
 * @description Callable that looks up a study group by invite code and adds the
 * caller as a member.  This runs server-side so Firestore rules can restrict
 * client-side list queries to members only.
 *
 * @param {Object} data
 * @param {string} data.inviteCode - The invite code to look up (case-insensitive).
 * @returns {{ success: true, data: { groupId: string, alreadyMember: boolean } }}
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { requireAuth, requireStrings } = require("../middleware/validate");
const { checkRateLimit, RATE_LIMITS } = require("../middleware/rateLimit");
const { db } = require("../lib/firestore");
const { Errors, fail, ok, safeError } = require("../lib/errors");
const log = require("../lib/logger");

exports.joinGroupByInvite = functions
  .runWith({ timeoutSeconds: 30 })
  .https.onCall(async (data, context) => {
    const uid = requireAuth(context);
    requireStrings(data, [{ field: "inviteCode", maxLen: 20 }]);
    // Dedicated rate limit for group joins (not reusing submitAttempt)
    await checkRateLimit(uid, "joinGroup", { maxCalls: 10, windowSeconds: 60 });

    const inviteCode = data.inviteCode.trim().toUpperCase();

    try {
      // Admin SDK bypasses security rules — allows lookup without membership
      const snap = await db
        .collection("studyGroups")
        .where("inviteCode", "==", inviteCode)
        .limit(1)
        .get();

      if (snap.empty) {
        return fail(Errors.NOT_FOUND, "Invalid invite code.");
      }

      const groupDoc = snap.docs[0];

      // Use a transaction to prevent memberCount drift from concurrent/retried joins
      const result = await db.runTransaction(async (tx) => {
        const freshDoc = await tx.get(groupDoc.ref);
        const freshData = freshDoc.data();

        // Already a member — no-op, return early
        if ((freshData.members || []).includes(uid)) {
          return { groupId: groupDoc.id, alreadyMember: true };
        }

        tx.update(groupDoc.ref, {
          members: admin.firestore.FieldValue.arrayUnion(uid),
          memberCount: (freshData.members || []).length + 1, // computed, not incremented
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return { groupId: groupDoc.id, alreadyMember: false };
      });

      if (!result.alreadyMember) {
        log.info("User joined group via invite", { uid, groupId: result.groupId });
      }
      return ok(result);
    } catch (error) {
      return safeError(error, "join group by invite");
    }
  });
