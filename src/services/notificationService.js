// ─────────────────────────────────────────────────────────────
// notificationService.js
// Sends FCM notifications via firebase-admin.
// Automatically prunes expired or invalid tokens.
// ─────────────────────────────────────────────────────────────

import { db, adminApp } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Send a notification to a specific user across all their registered devices.
 * @param {string} uid
 * @param {Object} payload
 * @param {string} payload.title
 * @param {string} payload.body
 * @param {Object} [payload.data]
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function sendPushNotification(uid, payload) {
  if (!uid || !payload || !db) return { sent: 0, failed: 0 };

  try {
    // 1. Fetch user's registered FCM tokens
    const snapshot = await db.collection('users').doc(uid).collection('fcmTokens').get();
    if (snapshot.empty) {
      return { sent: 0, failed: 0 };
    }

    const tokens = snapshot.docs.map(doc => doc.id);
    const results = { sent: 0, failed: 0 };

    // 2. Format FCM messaging payload
    const messagePayload = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    };

    // Use firebase-admin messaging service
    const messaging = admin.messaging(adminApp);

    for (const token of tokens) {
      try {
        await messaging.send({
          token,
          ...messagePayload,
        });
        results.sent++;
      } catch (err) {
        console.error(`[NOTIFICATION] Failed to send to token ${token}:`, err.message);
        results.failed++;

        // 3. Clean up expired/invalid tokens (FCM error codes like registration-token-not-registered)
        if (err.code === 'messaging/registration-token-not-registered' ||
          err.code === 'messaging/invalid-argument') {
          await db.collection('users').doc(uid).collection('fcmTokens').doc(token).delete();
          console.log(`[NOTIFICATION] Pruned expired token: ${token}`);
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`[NOTIFICATION] sendPushNotification failed for ${uid}:`, error.message);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Process proactive check-in notifications for inactive users.
 * Called by the admin /trigger-checkins cron endpoint.
 * Finds users inactive for 48+ hours and sends a "we miss you" push notification.
 * @returns {Promise<{ processed: number, notified: number }>}
 */
export async function processCheckins() {
  if (!db) {
    console.warn('[CHECK-INS] Firestore not available, skipping.');
    return { processed: 0, notified: 0 };
  }

  const results = { processed: 0, notified: 0 };

  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
    const usersSnapshot = await db.collection('users')
      .where('lastActiveAt', '<', cutoff.toISOString())
      .limit(50) // batch cap for free tier
      .get();

    if (usersSnapshot.empty) {
      console.log('[CHECK-INS] No inactive users found.');
      return results;
    }

    for (const userDoc of usersSnapshot.docs) {
      results.processed++;
      const userData = userDoc.data();
      const uid = userDoc.id;
      const name = userData.name || 'there';

      try {
        const sent = await sendPushNotification(uid, {
          title: 'We miss you 💙',
          body: `Hey ${name}, just checking in. Your mental wellness matters — take a moment for yourself today.`,
          data: { type: 'checkin', uid }
        });

        if (sent.sent > 0) {
          results.notified++;
        }
      } catch (err) {
        console.error(`[CHECK-INS] Failed to notify ${uid}:`, err.message);
      }
    }

    console.log(`[CHECK-INS] Complete: ${results.processed} processed, ${results.notified} notified.`);
    return results;
  } catch (error) {
    console.error('[CHECK-INS] processCheckins failed:', error.message);
    return results;
  }
}
