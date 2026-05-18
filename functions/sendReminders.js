// ─────────────────────────────────────────────────────────────
// sendReminders.js
// Cloud function utility triggers.
// Sends daily check-in reminders and insight notifications.
// ─────────────────────────────────────────────────────────────

import { db } from '../src/config/firebase.js';
import { sendPushNotification } from '../src/services/notificationService.js';

/**
 * Send check-in reminders to all users who haven't chatted today.
 */
export async function sendDailyCheckInReminders() {
  if (!db) return;

  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const usersSnapshot = await db.collection('users').listDocuments();

    let count = 0;
    for (const userDoc of usersSnapshot) {
      const uid = userDoc.id;

      // Check if user already chatted today (has streak active update for today)
      const streakDoc = await db.collection('users').doc(uid).collection('streaks').doc('current').get();
      const chattedToday = streakDoc.exists && streakDoc.data().lastActiveDate === todayStr;

      if (!chattedToday) {
        await sendPushNotification(uid, {
          title: 'Your MindDialogue companion is waiting 🌿',
          body: "Take 5 minutes to reflect on how you're feeling today.",
        });
        count++;
      }
    }

    console.log(`[REMINDERS] Daily check-in reminders sent to ${count} inactive users.`);
  } catch (error) {
    console.error('[REMINDERS] Daily check-in failed:', error.message);
  }
}

/**
 * Send push notification that a new daily insight is ready.
 * @param {string} uid
 */
export async function sendInsightReadyNotification(uid) {
  await sendPushNotification(uid, {
    title: 'Your daily insight is ready ✨',
    body: 'We processed yesterday\'s reflection. Come see your emotional weekly trends.',
  });
}
