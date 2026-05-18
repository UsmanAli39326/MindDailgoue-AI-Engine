// ─────────────────────────────────────────────────────────────
// moodService.js
// Auto-logs mood data extracted from AI response envelopes.
// Writes to Firestore: /users/{uid}/moodLog/{YYYY-MM-DD}
// Fire-and-forget — never blocks the response pipeline.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { encrypt, decrypt } from './encryptionService.js';

// ─── Public API ──────────────────────────────────────────────

/**
 * Log a mood entry from an AI response envelope.
 * This is fire-and-forget — errors are swallowed and logged.
 *
 * @param {string} uid - Firebase Auth user ID
 * @param {string} sessionId - Current session ID
 * @param {Object} envelope - The AI response envelope
 * @param {string} envelope.emotion - Detected emotion label
 * @param {number} envelope.intensity - Emotion intensity (0-1)
 * @param {number} envelope.stress_level - Stress level (0-1)
 */
export function logMood(uid, sessionId, envelope) {
  if (!uid || !envelope) return;
  if (!db) {
    console.warn('[MOOD SERVICE] Firestore not available. Skipping mood log.');
    return;
  }

  const encryptedEmotion = encrypt(envelope.emotion || 'neutral');

  const entry = {
    ts: new Date().toISOString(),
    emotion: encryptedEmotion.ciphertext,
    iv: encryptedEmotion.iv,
    intensity: typeof envelope.intensity === 'number' ? envelope.intensity : 0.5,
    stress: typeof envelope.stress_level === 'number' ? envelope.stress_level : 0.3,
    sessionId: sessionId || 'unknown',
  };

  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const docRef = db.collection('users').doc(uid).collection('moodLog').doc(today);

  // Fire-and-forget: use arrayUnion to append entry without overwriting
  docRef.set(
    { entries: FieldValue.arrayUnion(entry) },
    { merge: true }
  ).then(() => {
    console.log(`[MOOD SERVICE] Logged mood for ${uid}: ${entry.emotion} (${entry.intensity})`);
  }).catch((error) => {
    console.error('[MOOD SERVICE] Failed to log mood:', error.message);
  });
}

/**
 * Retrieve mood log entries for a user on a specific date.
 * @param {string} uid
 * @param {string} date - "YYYY-MM-DD"
 * @returns {Promise<Object|null>}
 */
export async function getMoodLogForDate(uid, date) {
  if (!uid || !date || !db) return null;

  try {
    const doc = await db.collection('users').doc(uid).collection('moodLog').doc(date).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (data && Array.isArray(data.entries)) {
      data.entries = data.entries.map(entry => {
        let decryptedEmotion = entry.emotion;
        if (entry.iv) {
          try {
            decryptedEmotion = decrypt(entry.emotion, entry.iv);
          } catch {
            // Retain ciphertext on failure
          }
        }
        return {
          ...entry,
          emotion: decryptedEmotion,
        };
      });
    }

    return data;
  } catch (error) {
    console.error('[MOOD SERVICE] Failed to fetch mood log:', error.message);
    return null;
  }
}

/**
 * Retrieve mood logs for a date range.
 * @param {string} uid
 * @param {number} days - Number of days to look back
 * @returns {Promise<Array<{ date: string, entries: Array }>>}
 */
export async function getMoodLogs(uid, days = 30) {
  if (!uid || !db) return [];

  try {
    // Generate date strings for the range
    const dates = [];
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const results = [];
    // Firestore: batch get by document IDs
    for (const date of dates) {
      const doc = await db.collection('users').doc(uid).collection('moodLog').doc(date).get();
      if (doc.exists) {
        const data = doc.data();
        if (data && Array.isArray(data.entries)) {
          data.entries = data.entries.map(entry => {
            let decryptedEmotion = entry.emotion;
            if (entry.iv) {
              try {
                decryptedEmotion = decrypt(entry.emotion, entry.iv);
              } catch {
                // Retain ciphertext on failure
              }
            }
            return {
              ...entry,
              emotion: decryptedEmotion,
            };
          });
        }
        results.push({ date, ...data });
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('[MOOD SERVICE] Failed to fetch mood logs:', error.message);
    return [];
  }
}
