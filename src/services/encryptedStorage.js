// ─────────────────────────────────────────────────────────────
// encryptedStorage.js
// Zero-knowledge encrypted message storage.
// Backend stores only ciphertext + IV — never sees plaintext.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';
import { encrypt, decrypt } from './encryptionService.js';

/**
 * Store a single encrypted message.
 * @param {string} uid
 * @param {Object} message
 * @param {string} message.ciphertext - Client-encrypted or server-encrypted payload
 * @param {string} message.iv - Initialization vector (or 'plaintext' for server-side encryption)
 * @param {string} message.sessionId
 * @param {string} [message.role] - 'user' or 'assistant'
 * @param {string} [message.client_id] - Client-generated ID for offline sync
 * @returns {Promise<{ id: string, timestamp: string } | null>}
 */
export async function storeEncryptedMessage(uid, message) {
  if (!uid || !message || !db) return null;

  const { ciphertext, iv, sessionId, role, client_id } = message;

  if (!ciphertext || !iv || !sessionId) {
    console.warn('[ENCRYPTED STORAGE] Missing required fields.');
    return null;
  }

  let finalCiphertext = ciphertext;
  let finalIv = iv;

  if (iv === 'plaintext') {
    try {
      const encrypted = encrypt(ciphertext);
      finalCiphertext = encrypted.ciphertext;
      finalIv = encrypted.iv;
    } catch (error) {
      console.error('[ENCRYPTED STORAGE] Server-side encryption failed:', error.message);
      return null;
    }
  }

  // Idempotency: Deduplicate client_id to prevent duplicates in batch synchronization
  if (client_id) {
    try {
      const existingQuery = await db
        .collection('users')
        .doc(uid)
        .collection('messages')
        .where('client_id', '==', client_id)
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        const existingDoc = existingQuery.docs[0];
        console.log(`[ENCRYPTED STORAGE] Duplicate message detected (client_id: ${client_id}). Returning existing document ${existingDoc.id}.`);
        return {
          id: existingDoc.id,
          timestamp: existingDoc.data().timestamp,
          duplicate: true
        };
      }
    } catch (err) {
      console.warn('[ENCRYPTED STORAGE] Idempotency check failed:', err.message);
    }
  }

  try {
    const timestamp = new Date().toISOString();
    const doc = {
      ciphertext: finalCiphertext,
      iv: finalIv,
      sessionId,
      role: role || 'user',
      timestamp,
      ...(client_id ? { client_id } : {}),
    };

    const ref = await db
      .collection('users')
      .doc(uid)
      .collection('messages')
      .add(doc);

    // Atomically increment the session's messageCount field in Firestore
    await db
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .doc(sessionId)
      .update({
        messageCount: FieldValue.increment(1)
      })
      .catch(err => {
        // Safe bypass if the session document does not exist yet (e.g. dev mode fallback)
        console.warn(`[ENCRYPTED STORAGE] Could not increment messageCount for session ${sessionId}: ${err.message}`);
      });

    return { id: ref.id, timestamp };
  } catch (error) {
    console.error('[ENCRYPTED STORAGE] Store failed:', error.message);
    return null;
  }
}

/**
 * Store a batch of encrypted messages (offline sync).
 * @param {string} uid
 * @param {Array} messages
 * @returns {Promise<Array<{ client_id: string, server_id: string, timestamp: string }>>}
 */
export async function storeBatchMessages(uid, messages) {
  if (!uid || !Array.isArray(messages) || !db) return [];

  const results = [];

  for (const msg of messages) {
    const result = await storeEncryptedMessage(uid, msg);
    results.push({
      client_id: msg.client_id || null,
      server_id: result?.id || null,
      timestamp: result?.timestamp || null,
      success: !!result,
      ...(result?.duplicate ? { duplicate: true } : {}),
    });
  }

  return results;
}

/**
 * Get paginated encrypted messages for a session.
 * @param {string} uid
 * @param {string} sessionId
 * @param {number} [limit=50]
 * @param {string} [startAfter] - Firestore document ID for pagination
 * @returns {Promise<{ messages: Array, hasMore: boolean }>}
 */
export async function getSessionMessages(uid, sessionId, limit = 50, startAfter = null) {
  if (!uid || !sessionId || !db) return { messages: [], hasMore: false };

  try {
    let query = db
      .collection('users')
      .doc(uid)
      .collection('messages')
      .where('sessionId', '==', sessionId)
      .orderBy('timestamp', 'asc');

    if (startAfter) {
      const startAfterDoc = await db
        .collection('users')
        .doc(uid)
        .collection('messages')
        .doc(startAfter)
        .get();
      
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc);
      }
    }

    // Retrieve limit + 1 messages to determine hasMore
    query = query.limit(limit + 1);

    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => {
      const data = doc.data();
      let decryptedText = data.ciphertext;

      if (data.iv && data.iv !== 'plaintext') {
        try {
          decryptedText = decrypt(data.ciphertext, data.iv);
        } catch (error) {
          // Decryption failed. It is either client-side encrypted (E2E) or malformed.
          // Retain original ciphertext so the client can decrypt it locally.
        }
      }

      return {
        id: doc.id,
        ...data,
        ciphertext: decryptedText,
      };
    });

    const hasMore = docs.length > limit;
    const paginatedDocs = hasMore ? docs.slice(0, limit) : docs;

    return {
      messages: paginatedDocs,
      hasMore,
    };
  } catch (error) {
    console.error('[ENCRYPTED STORAGE] Fetch failed:', error.message);
    return { messages: [], hasMore: false };
  }
}

/**
 * Delete all messages in a session.
 * @param {string} uid
 * @param {string} sessionId
 */
export async function deleteSessionMessages(uid, sessionId) {
  if (!uid || !sessionId || !db) return;

  try {
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('messages')
      .where('sessionId', '==', sessionId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[ENCRYPTED STORAGE] Deleted ${snapshot.size} messages for session ${sessionId}`);
  } catch (error) {
    console.error('[ENCRYPTED STORAGE] Delete failed:', error.message);
  }
}
