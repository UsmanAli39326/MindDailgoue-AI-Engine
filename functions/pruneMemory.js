// ─────────────────────────────────────────────────────────────
// pruneMemory.js
// Weekly Cloud Function to prune old memory blobs.
// Removes blobs older than 60 days if count > 20.
// ─────────────────────────────────────────────────────────────

import { db } from '../src/config/firebase.js';

const MAX_BLOBS = 20;
const MAX_AGE_DAYS = 60;

/**
 * Prune memory blobs for a single user.
 * @param {string} uid
 * @returns {Promise<number>} Number of blobs pruned
 */
export async function pruneUserMemory(uid) {
  if (!uid || !db) return 0;

  try {
    const snapshot = await db.collection('users').doc(uid).collection('memory')
      .orderBy('createdAt', 'asc')
      .get();

    if (snapshot.size <= MAX_BLOBS) return 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);
    const cutoffISO = cutoffDate.toISOString();

    const toDelete = [];
    for (const doc of snapshot.docs) {
      const createdAt = doc.data().createdAt;
      if (createdAt && createdAt < cutoffISO && snapshot.size - toDelete.length > MAX_BLOBS) {
        toDelete.push(doc.ref);
      }
    }

    if (toDelete.length === 0) return 0;

    const batch = db.batch();
    toDelete.forEach(ref => batch.delete(ref));
    await batch.commit();

    console.log(`[PRUNE] Removed ${toDelete.length} old memory blobs for user ${uid}`);
    return toDelete.length;
  } catch (error) {
    console.error(`[PRUNE] Failed for user ${uid}:`, error.message);
    return 0;
  }
}

/**
 * Run memory pruning for all users.
 * Designed to be triggered by a weekly Cloud Function scheduler.
 */
export async function pruneAllMemory() {
  if (!db) {
    console.warn('[PRUNE] Firestore not available.');
    return;
  }

  try {
    const usersSnapshot = await db.collection('users').listDocuments();

    let totalPruned = 0;
    for (const userDoc of usersSnapshot) {
      const pruned = await pruneUserMemory(userDoc.id);
      totalPruned += pruned;
    }

    console.log(`[PRUNE] Weekly cleanup complete. ${totalPruned} blobs pruned across all users.`);
  } catch (error) {
    console.error('[PRUNE] Batch prune failed:', error.message);
  }
}

export const _internals = { MAX_BLOBS, MAX_AGE_DAYS };
