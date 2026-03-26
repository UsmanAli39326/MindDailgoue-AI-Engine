// ─────────────────────────────────────────────────────────────
// memoryManager.js
// In-memory short-term session storage with persona locking
// and bounded message history.
// Stateful module — maintains session state in a Map.
// ─────────────────────────────────────────────────────────────

// ─── Configuration ──────────────────────────────────────────

const MAX_MESSAGES_PER_SESSION = 50;  // hard cap — prevents unbounded growth
const DEFAULT_RECENT_COUNT = 10;      // default for getRecentHistory

// ─── Session Store ──────────────────────────────────────────
// Shape: Map<sessionId, { therapistId: string, messages: Message[] }>
// Message: { role: 'user' | 'assistant', text: string, timestamp: string }

/** @type {Map<string, { therapistId: string, messages: Array<{ role: string, text: string, timestamp: string }> }>} */
const sessionStore = new Map();

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
  if (messages.length === 0) {
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
 * Get or create a session. Locks the therapistId on first creation.
 * Throws if a different therapistId is passed for an existing session.
 *
 * @param {string} sessionId
 * @param {string} therapistId
 * @returns {{ therapistId: string, messages: Array }}
 * @throws {Error} if therapistId mismatch on existing session
 */
export function getOrCreateSession(sessionId, therapistId) {
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId must be a non-empty string.');
  }
  if (typeof therapistId !== 'string' || therapistId.trim().length === 0) {
    throw new Error('therapistId must be a non-empty string.');
  }

  if (sessionStore.has(sessionId)) {
    const session = sessionStore.get(sessionId);
    if (session.therapistId !== therapistId) {
      throw new Error(
        `Persona change rejected. Session "${sessionId}" is locked to ` +
        `therapist "${session.therapistId}". Use resetSession() to change persona.`
      );
    }
    return session;
  }

  // Create new session with locked persona
  const session = {
    therapistId,
    messages: [],
  };
  sessionStore.set(sessionId, session);
  return session;
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
export function appendMessage(sessionId, role, text) {
  if (!sessionStore.has(sessionId)) {
    throw new Error(`Session "${sessionId}" does not exist. Call getOrCreateSession first.`);
  }
  if (role !== 'user' && role !== 'assistant') {
    throw new Error('Role must be "user" or "assistant".');
  }
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Message text must be a non-empty string.');
  }

  const session = sessionStore.get(sessionId);
  session.messages.push({
    role,
    text,
    timestamp: new Date().toISOString(),
  });

  // Enforce hard cap
  session.messages = enforceMessageCap(session.messages);
}

/**
 * Get recent conversation history for a session,
 * formatted as a prompt-ready string.
 *
 * @param {string} sessionId
 * @param {number} [maxMessages=10] — number of recent messages to retrieve
 * @returns {string} — formatted conversation history
 */
export function getRecentHistory(sessionId, maxMessages = DEFAULT_RECENT_COUNT) {
  if (!sessionStore.has(sessionId)) {
    return 'No previous conversation history.';
  }

  const session = sessionStore.get(sessionId);
  const recent = session.messages.slice(-maxMessages);
  return formatHistory(recent);
}

/**
 * Get the locked therapist ID for a session.
 *
 * @param {string} sessionId
 * @returns {string | null}
 */
export function getSessionTherapistId(sessionId) {
  if (!sessionStore.has(sessionId)) {
    return null;
  }
  return sessionStore.get(sessionId).therapistId;
}

/**
 * Explicitly reset a session, allowing persona change.
 *
 * @param {string} sessionId
 */
export function resetSession(sessionId) {
  sessionStore.delete(sessionId);
}

/**
 * Clear all sessions (for testing).
 */
export function clearAll() {
  sessionStore.clear();
}

// Export internals for unit testing
export const _internals = {
  sessionStore,
  enforceMessageCap,
  formatHistory,
  MAX_MESSAGES_PER_SESSION,
  DEFAULT_RECENT_COUNT,
};
