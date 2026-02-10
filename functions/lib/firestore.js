/**
 * @module lib/firestore
 * @description Shared Firestore instance and batch-operation helpers.
 *
 * Every module that needs Firestore should import `db` from here instead of
 * calling `admin.firestore()` independently.  The batch helpers eliminate the
 * boilerplate of chunking writes/deletes into 500-document batches.
 */

const admin = require("firebase-admin");
const { FIRESTORE_BATCH_LIMIT } = require("./constants");

const db = admin.firestore();

/**
 * Write an array of documents in Firestore-safe 500-doc batches.
 *
 * @param {Array<{ ref: FirebaseFirestore.DocumentReference, data: object }>} items
 *   Each entry must include the target document `ref` and the `data` to set.
 * @returns {Promise<number>} Total documents written.
 */
async function batchSet(items) {
  let written = 0;
  for (let i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.set(ref, data);
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

/**
 * Delete an array of document references in Firestore-safe 500-doc batches.
 *
 * @param {Array<FirebaseFirestore.DocumentReference>} refs
 * @returns {Promise<number>} Total documents deleted.
 */
async function batchDelete(refs) {
  let deleted = 0;
  for (let i = 0; i < refs.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = refs.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();
    for (const ref of chunk) {
      batch.delete(ref);
    }
    await batch.commit();
    deleted += chunk.length;
  }
  return deleted;
}

/**
 * Update an array of documents in Firestore-safe 500-doc batches.
 *
 * @param {Array<{ ref: FirebaseFirestore.DocumentReference, data: object }>} items
 *   Each entry must include the target document `ref` and the partial `data` to update.
 * @returns {Promise<number>} Total documents updated.
 */
async function batchUpdate(items) {
  let updated = 0;
  for (let i = 0; i < items.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = items.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = db.batch();
    for (const { ref, data } of chunk) {
      batch.update(ref, data);
    }
    await batch.commit();
    updated += chunk.length;
  }
  return updated;
}

module.exports = { db, batchSet, batchDelete, batchUpdate };
