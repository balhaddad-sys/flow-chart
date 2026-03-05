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
    await checkRateLimit(uid, "joinGroup", RATE_LIMITS.submitAttempt);

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
      const groupData = groupDoc.data();

      // Already a member — just return the group ID
      if ((groupData.members || []).includes(uid)) {
        return ok({ groupId: groupDoc.id, alreadyMember: true });
      }

      // Add user to group atomically
      await groupDoc.ref.update({
        members: admin.firestore.FieldValue.arrayUnion(uid),
        memberCount: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      log.info("User joined group via invite", { uid, groupId: groupDoc.id });
      return ok({ groupId: groupDoc.id, alreadyMember: false });
    } catch (error) {
      return safeError(error, "join group by invite");
    }
  });
