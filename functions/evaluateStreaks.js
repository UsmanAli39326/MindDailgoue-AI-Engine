// ─────────────────────────────────────────────────────────────
// evaluateStreaks.js
// Nightly Cloud Function to evaluate and update user streaks.
// Resets streaks that have exceeded the 48-hour grace window.
// ─────────────────────────────────────────────────────────────

import { db } from '../src/config/firebase.js';

/**
 * Evaluate streak continuity for a single user.
 * @param {string} uid
 * @returns {Promise<boolean>} Whether the streak was reset
 */
export async function evaluateUserStreak(uid) {
  if (!uid || !db) return false;

  const docRef = db.collection('users').doc(uid).collection('streaks').doc('current');

  try {
    const doc = await docRef.get();
    if (!doc.exists) return false;

    const data = doc.data();
    const lastActive = data.lastActiveDate;
    if (!lastActive) return false;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    const lastActiveDate = new Date(lastActive);
    const todayDate = new Date(todayStr);

    const diffTime = Math.abs(todayDate - lastActiveDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 2) {
      // Exceeded the 48-hour grace window. Reset streak.
      await docRef.update({
        currentStreak: 0,
        graceUsed: false,
      });
      console.log(`[STREAK EVAL] Reset streak for user ${uid}. Days inactive: ${diffDays}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[STREAK EVAL] Failed for user ${uid}:`, error.message);
    return false;
  }
}

/**
 * Evaluate streaks for all users.
 */
export async function evaluateAllStreaks() {
  if (!db) return;

  try {
    const usersSnapshot = await db.collection('users').listDocuments();

    let resetCount = 0;
    for (const userDoc of usersSnapshot) {
      const reset = await evaluateUserStreak(userDoc.id);
      if (reset) resetCount++;
    }

    console.log(`[STREAK EVAL] Nightly evaluation complete. ${resetCount} streaks reset.`);
  } catch (error) {
    console.error('[STREAK EVAL] Batch evaluation failed:', error.message);
  }
}
