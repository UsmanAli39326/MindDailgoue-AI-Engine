// ─────────────────────────────────────────────────────────────
// streakService.js
// Tracks and maintains user engagement streaks with a 48-hour grace period.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';

/**
 * Record user activity for today and update their streak.
 * Fire-and-forget — swallowed error handling.
 * @param {string} uid
 */
export function recordActivity(uid) {
  if (!uid || !db) return;

  const docRef = db.collection('users').doc(uid).collection('streaks').doc('current');

  db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"

    if (!doc.exists) {
      // First activity ever
      const newStreak = {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: todayStr,
        graceUsed: false,
        totalDays: 1,
        activityDates: [todayStr],
      };
      transaction.set(docRef, newStreak);
      console.log(`[STREAK] Created streak profile for user ${uid}`);
      return;
    }

    const data = doc.data();
    const lastActive = data.lastActiveDate;

    if (lastActive === todayStr) {
      // Already active today, nothing to change
      return;
    }

    const lastActiveDate = new Date(lastActive);
    const todayDate = new Date(todayStr);

    // Calculate difference in hours/days
    const diffTime = Math.abs(todayDate - lastActiveDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let { currentStreak, longestStreak, graceUsed, totalDays, activityDates = [] } = data;

    if (!activityDates.includes(todayStr)) {
      activityDates.push(todayStr);
    }

    if (diffDays === 1) {
      // Consecutive day!
      currentStreak += 1;
      graceUsed = false; // reset grace usage
    } else if (diffDays === 2) {
      // Missed exactly 1 day. Use grace period!
      currentStreak += 1; // streak continues!
      graceUsed = true;
      console.log(`[STREAK] Grace period applied for user ${uid}. Missed day covered.`);
    } else {
      // Missed more than 2 days. Streak resets.
      currentStreak = 1;
      graceUsed = false;
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    totalDays = activityDates.length;

    transaction.update(docRef, {
      currentStreak,
      longestStreak,
      lastActiveDate: todayStr,
      graceUsed,
      totalDays,
      activityDates,
    });

    console.log(`[STREAK] Updated streak for user ${uid}: current=${currentStreak}, longest=${longestStreak}`);
  }).catch(err => {
    console.error('[STREAK] Transaction failed:', err.message);
  });
}

/**
 * Get a user's current streak status.
 * @param {string} uid
 * @returns {Promise<Object>}
 */
export async function getStreakStatus(uid) {
  if (!uid || !db) {
    return { currentStreak: 0, longestStreak: 0, totalDays: 0, graceUsed: false };
  }

  try {
    const doc = await db.collection('users').doc(uid).collection('streaks').doc('current').get();
    if (!doc.exists) {
      return { currentStreak: 0, longestStreak: 0, totalDays: 0, graceUsed: false };
    }
    return doc.data();
  } catch (error) {
    console.error('[STREAK] Get failed:', error.message);
    return { currentStreak: 0, longestStreak: 0, totalDays: 0, graceUsed: false };
  }
}
