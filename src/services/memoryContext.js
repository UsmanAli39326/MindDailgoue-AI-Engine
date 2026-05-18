// ─────────────────────────────────────────────────────────────
// memoryContext.js
// Fetches cross-session memory blobs from Firestore and
// injects them into the system prompt.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { decrypt } from './encryptionService.js';

const MAX_BLOBS = 3;
const MAX_TOKENS_ESTIMATE = 400; // rough character cap (~400 tokens ≈ 1600 chars)
const MAX_CHARS = MAX_TOKENS_ESTIMATE * 4;

/**
 * Fetch the most recent memory blobs for a user.
 * @param {string} uid
 * @param {number} [limit=3]
 * @returns {Promise<Array<{ summary: string, themes: string[], createdAt: string }>>}
 */
export async function fetchMemoryBlobs(uid, limit = MAX_BLOBS) {
  if (!uid || !db) return [];

  try {
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('memory')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    if (snapshot.empty) return [];

    return snapshot.docs.map(doc => {
      const data = doc.data();
      let decryptedSummary = data.summary;

      if (data.iv) {
        try {
          decryptedSummary = decrypt(data.summary, data.iv);
        } catch (error) {
          // Keep ciphertext on decryption failure
        }
      }

      return {
        id: doc.id,
        summary: decryptedSummary,
        themes: data.themes || [],
        createdAt: data.createdAt,
        sessionId: data.sessionId,
      };
    });
  } catch (error) {
    console.error('[MEMORY CONTEXT] Failed to fetch memory blobs:', error.message);
    return [];
  }
}

/**
 * Build a context string from memory blobs for injection into
 * the system prompt. Capped at ~400 tokens.
 * @param {Array} blobs - From fetchMemoryBlobs()
 * @returns {string}
 */
export function buildCrossSessionContext(blobs) {
  if (!Array.isArray(blobs) || blobs.length === 0) return '';

  let context = '\n[PREVIOUS SESSION CONTEXT]\n';
  let charCount = context.length;

  for (const blob of blobs) {
    const entry = `- (${blob.createdAt?.slice(0, 10) || 'unknown'}): ${blob.summary}\n`;
    if (charCount + entry.length > MAX_CHARS) break;
    context += entry;
    charCount += entry.length;
  }

  return context;
}

/**
 * Full pipeline: fetch blobs + build context string.
 * @param {string} uid
 * @returns {Promise<string>}
 */
export async function getSessionContext(uid) {
  const blobs = await fetchMemoryBlobs(uid);
  return buildCrossSessionContext(blobs);
}

export const _internals = {
  MAX_BLOBS,
  MAX_CHARS,
};
