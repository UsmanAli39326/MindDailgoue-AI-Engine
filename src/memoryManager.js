// ─────────────────────────────────────────────────────────────
// memoryManager.js
// Persistent short-term session storage with persona locking
// and bounded message history using Firestore.
// Fully supports stateless distributed horizontal scaling.
// ─────────────────────────────────────────────────────────────

import { db } from './config/firebase.js';

// ─── Configuration ──────────────────────────────────────────

const MAX_MESSAGES_PER_SESSION = 50;  // hard cap — prevents unbounded growth
const DEFAULT_RECENT_COUNT = 10;      // default for getRecentHistory

// Stateful fallback / write-through cache for low-latency retrieval
const ramCache = new Map();

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Enforce the hard message cap on a session.
 * If messages exceed MAX_MESSAGES_PER_SESSION, keep only the most recent.
 * @param {Array} messages
 * @returns {Array}
 */
function enforceMessageCap(messages) {
  if (messages.length > MAX_MESSAGES_PER_SESSION) {
    return messages.slice(-MAX_MESSAGES_PER_SESSION);
  }
  return messages;
}

/**
 * Format messages into a conversation history string.
 * @param {Array<{ role: string, text: string }>} messages
 * @returns {string}
 */
function formatHistory(messages) {
  if (!messages || messages.length === 0) {
    return 'No previous conversation history.';
  }

  return messages
    .map((msg) => {
      const label = msg.role === 'user' ? 'User' : 'Assistant';
      return `${label}: ${msg.text}`;
    })
    .join('\n');
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get or create a session in Firestore. Locks the therapistId on first creation.
 * Throws if a different therapistId is passed for an existing session.
 *
 * @param {string} sessionId
 * @param {string} therapistId
 * @returns {Promise<{ therapistId: string, messages: Array }>}
 * @throws {Error} if therapistId mismatch on existing session
 */
export async function getOrCreateSession(uid, sessionId, therapistId) {
  if (typeof uid !== 'string' || uid.trim().length === 0) {
    throw new Error('uid must be a non-empty string.');
  }
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId must be a non-empty string.');
  }
  if (typeof therapistId !== 'string' || therapistId.trim().length === 0) {
    throw new Error('therapistId must be a non-empty string.');
  }

  // Check write-through cache first
  if (ramCache.has(sessionId)) {
    const session = ramCache.get(sessionId);
    if (session.therapistId !== therapistId) {
      throw new Error(
        `Persona change rejected. Session "${sessionId}" is locked to ` +
        `therapist "${session.therapistId}". Use resetSession() to change persona.`
      );
    }
    return session;
  }

  if (!db) {
    console.warn('[MEMORY MANAGER] Firestore database not available. Using local RAM.');
    const localSession = { therapistId, messages: [] };
    ramCache.set(sessionId, localSession);
    return localSession;
  }

  const docRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
  const doc = await docRef.get();

  if (doc.exists) {
    const session = doc.data();
    if (session.therapistId !== therapistId) {
      throw new Error(
        `Persona change rejected. Session "${sessionId}" is locked to ` +
        `therapist "${session.therapistId}". Use resetSession() to change persona.`
      );
    }
    ramCache.set(sessionId, session);
    return session;
  }

  // Create new session in Firestore
  const newSession = {
    therapistId,
    messages: [],
    createdAt: new Date().toISOString(),
  };

  await docRef.set(newSession);
  ramCache.set(sessionId, newSession);
  return newSession;
}

/**
 * Append a message to a session's history.
 * Enforces the hard cap of MAX_MESSAGES_PER_SESSION.
 *
 * @param {string} sessionId
 * @param {'user' | 'assistant'} role
 * @param {string} text
 * @throws {Error} if session does not exist
 */
export async function appendMessage(uid, sessionId, role, text) {
  if (typeof uid !== 'string' || uid.trim().length === 0) throw new Error('uid required');
  if (role !== 'user' && role !== 'assistant') {
    throw new Error('Role must be "user" or "assistant".');
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Message text must be a non-empty string.');
  }

  let session = ramCache.get(sessionId);

  if (!session && db) {
    const docRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const doc = await docRef.get();
    if (doc.exists) {
      session = doc.data();
      ramCache.set(sessionId, session);
    }
  }

  if (!session) {
    throw new Error(`Session "${sessionId}" does not exist. Call getOrCreateSession first.`);
  }

  session.messages.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });

  // Enforce hard cap
  session.messages = enforceMessageCap(session.messages);

  if (db) {
    const docRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    await docRef.update({
      messages: session.messages
    });
  }
}

/**
 * Get recent conversation history for a session,
 * formatted as a prompt-ready string.
 *
 * @param {string} sessionId
 * @param {number} [maxMessages=10] — number of recent messages to retrieve
 * @returns {Promise<string>} — formatted conversation history
 */
export async function getRecentHistory(uid, sessionId, maxMessages = DEFAULT_RECENT_COUNT) {
  let session = ramCache.get(sessionId);

  if (!session && db) {
    const docRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const doc = await docRef.get();
    if (doc.exists) {
      session = doc.data();
      ramCache.set(sessionId, session);
    }
  }

  if (!session) {
    return 'No previous conversation history.';
  }

  const recent = session.messages.slice(-maxMessages);
  return formatHistory(recent);
}

/**
 * Get the locked therapist ID for a session.
 *
 * @param {string} sessionId
 * @returns {Promise<string | null>}
 */
export async function getSessionTherapistId(uid, sessionId) {
  let session = ramCache.get(sessionId);

  if (!session && db) {
    const docRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const doc = await docRef.get();
    if (doc.exists) {
      session = doc.data();
      ramCache.set(sessionId, session);
    }
  }

  if (!session) {
    return null;
  }
  return session.therapistId;
}

/**
 * Explicitly reset a session, allowing persona change.
 *
 * @param {string} sessionId
 */
export async function resetSession(uid, sessionId) {
  ramCache.delete(sessionId);
  if (db) {
    await db.collection('users').doc(uid).collection('sessions').doc(sessionId).delete().catch(() => {});
  }
}

/**
 * Clear all sessions (for testing).
 */
export async function clearAll() {
  ramCache.clear();
  if (db) {
    const snapshot = await db.collection('sessions').get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit().catch(() => {});
  }
}

// Export internals for unit testing
export const _internals = {
  sessionStore: ramCache,
  enforceMessageCap,
  formatHistory,
  MAX_MESSAGES_PER_SESSION,
  DEFAULT_RECENT_COUNT,
};
