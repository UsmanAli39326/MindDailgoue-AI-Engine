// ─────────────────────────────────────────────────────────────
// themeTracker.js
// Extracts themes from memory summaries and maintains frequency
// counts in /users/{uid}/themeProfile.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Update theme profile with new themes from a memory summary.
 * Fire-and-forget — errors are logged but don't propagate.
 * @param {string} uid
 * @param {string[]} themes
 */
export function updateThemes(uid, themes) {
  if (!uid || !Array.isArray(themes) || themes.length === 0) return;
  if (!db) return;

  const docRef = db.collection('users').doc(uid).collection('themeProfile').doc('current');

  // Build increment map: { "anxiety": FieldValue.increment(1), ... }
  const updates = {};
  for (const theme of themes) {
    const key = theme.toLowerCase().trim();
    if (key.length > 0 && key.length <= 50) {
      updates[`themes.${key}`] = FieldValue.increment(1);
    }
  }

  if (Object.keys(updates).length === 0) return;

  updates.lastUpdated = new Date().toISOString();

  docRef.set(updates, { merge: true })
    .then(() => console.log(`[THEME TRACKER] Updated themes for ${uid}: ${themes.join(', ')}`))
    .catch(err => console.error('[THEME TRACKER] Failed:', err.message));
}

/**
 * Get the current theme profile for a user.
 * @param {string} uid
 * @returns {Promise<{ themes: Object<string, number>, lastUpdated: string } | null>}
 */
export async function getThemeProfile(uid) {
  if (!uid || !db) return null;

  try {
    const doc = await db.collection('users').doc(uid).collection('themeProfile').doc('current').get();
    if (!doc.exists) return { themes: {}, lastUpdated: null };

    const data = doc.data();
    return {
      themes: data.themes || {},
      lastUpdated: data.lastUpdated || null,
    };
  } catch (error) {
    console.error('[THEME TRACKER] Failed to fetch:', error.message);
    return null;
  }
}

/**
 * Get the top N themes sorted by frequency.
 * @param {string} uid
 * @param {number} [n=5]
 * @returns {Promise<Array<{ theme: string, count: number }>>}
 */
export async function getTopThemes(uid, n = 5) {
  const profile = await getThemeProfile(uid);
  if (!profile || !profile.themes) return [];

  return Object.entries(profile.themes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([theme, count]) => ({ theme, count }));
}
