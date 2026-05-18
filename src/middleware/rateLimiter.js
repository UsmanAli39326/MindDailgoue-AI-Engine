// ─────────────────────────────────────────────────────────────
// rateLimiter.js
// Sliding-window rate limiter middleware with Firestore persistence.
// Limits: 60 messages/hour/user, 5 sessions/day/user.
// Supports distributed multi-node state synchronization.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';

// ─── Default Limits ──────────────────────────────────────────
const DEFAULT_LIMITS = {
  messagesPerHour: 60,
  sessionsPerDay: 5,
};

// ─── Per-tier overrides (set via admin endpoint) ─────────────
// Map<uid, { messagesPerHour, sessionsPerDay }>
const userOverrides = new Map();

// ─── In-Memory Cache (Write-Through) ─────────────────────────
// Map<uid, number[]> — timestamps of messages within the sliding window
const messageTimestamps = new Map();

// Map<uid, Set<string>> — unique sessionIds seen today
const dailySessions = new Map();

// Track which UTC day we last reset daily sessions
let lastResetDay = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"

// ─── Helpers ─────────────────────────────────────────────────

function getLimitsForUser(uid) {
  return userOverrides.get(uid) || { ...DEFAULT_LIMITS };
}

function resetDailyIfNeeded() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDay) {
    dailySessions.clear();
    lastResetDay = today;
  }
}

/**
 * Prune message timestamps older than 1 hour from the sliding window.
 */
function pruneOldTimestamps(uid) {
  const timestamps = messageTimestamps.get(uid);
  if (!timestamps) return;

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  // Find first index that is within the window
  let firstValid = 0;
  while (firstValid < timestamps.length && timestamps[firstValid] < oneHourAgo) {
    firstValid++;
  }
  if (firstValid > 0) {
    timestamps.splice(0, firstValid);
  }
}

/**
 * Load rate limit state from Firestore into RAM cache if missing.
 */
async function loadStateFromFirestore(uid) {
  if (!db) return;

  try {
    const doc = await db.collection('rateLimits').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      
      const today = new Date().toISOString().slice(0, 10);
      if (data.lastResetDay === today) {
        dailySessions.set(uid, new Set(data.dailySessions || []));
      } else {
        dailySessions.set(uid, new Set());
      }

      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const validTimestamps = (data.messageTimestamps || []).filter(t => t >= oneHourAgo);
      messageTimestamps.set(uid, validTimestamps);
    }
  } catch (err) {
    console.error(`[RATE LIMITER] Error loading state from Firestore for ${uid}:`, err.message);
  }
}

/**
 * Save rate limit state back to Firestore.
 */
async function saveStateToFirestore(uid) {
  if (!db) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const timestamps = messageTimestamps.get(uid) || [];
    const sessions = Array.from(dailySessions.get(uid) || []);

    await db.collection('rateLimits').doc(uid).set({
      messageTimestamps: timestamps,
      dailySessions: sessions,
      lastResetDay: today
    });
  } catch (err) {
    console.error(`[RATE LIMITER] Error saving state to Firestore for ${uid}:`, err.message);
  }
}

// ─── Express Middleware ──────────────────────────────────────

/**
 * Rate limiter middleware.
 * Must be applied AFTER auth middleware (needs req.user.uid).
 * Skips if no uid is available (e.g., development mode fallback).
 */
export async function rateLimit(req, res, next) {
  const uid = req.user?.uid;
  if (!uid) return next(); // Can't rate-limit without identity

  resetDailyIfNeeded();

  // If this uid's state is not loaded into RAM cache, pull it from Firestore first
  if (!messageTimestamps.has(uid) && !dailySessions.has(uid)) {
    await loadStateFromFirestore(uid);
  }

  const limits = getLimitsForUser(uid);
  const now = Date.now();

  // ── Message rate check (sliding window: 1 hour) ──────────
  pruneOldTimestamps(uid);

  const timestamps = messageTimestamps.get(uid) || [];
  if (timestamps.length >= limits.messagesPerHour) {
    const oldestInWindow = timestamps[0];
    const retryAfterMs = (oldestInWindow + 60 * 60 * 1000) - now;
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You have reached the maximum of ${limits.messagesPerHour} messages per hour. Please take a moment to reflect and try again shortly.`,
      retryAfter: retryAfterSec,
      limitType: 'messages_per_hour',
    });
  }

  // ── Session rate check (daily cap) ───────────────────────
  const sessionId = req.body?.sessionId;
  if (sessionId) {
    const userSessions = dailySessions.get(uid) || new Set();

    if (!userSessions.has(sessionId) && userSessions.size >= limits.sessionsPerDay) {
      return res.status(429).json({
        error: 'Session limit exceeded',
        message: `You have reached the maximum of ${limits.sessionsPerDay} sessions per day. Please continue in an existing session or come back tomorrow.`,
        retryAfter: getSecondsUntilMidnightUTC(),
        limitType: 'sessions_per_day',
      });
    }

    // Register the session
    userSessions.add(sessionId);
    dailySessions.set(uid, userSessions);
  }

  // ── Record this message timestamp (Only for message creation endpoints) ──
  const isMessageEndpoint = req.method === 'POST' && (req.path.startsWith('/chat') || req.path.startsWith('/messages'));
  if (isMessageEndpoint) {
    timestamps.push(now);
    messageTimestamps.set(uid, timestamps);
  }

  // Asynchronously save state to Firestore (non-blocking for ultra-fast API latency)
  saveStateToFirestore(uid).catch(err => {
    console.error(`[RATE LIMITER] Background state save failed for user ${uid}:`, err.message);
  });

  next();
}

// ─── Admin API ───────────────────────────────────────────────

/**
 * Set custom rate limits for a specific user (tier override).
 * @param {string} uid
 * @param {{ messagesPerHour?: number, sessionsPerDay?: number }} overrides
 */
export function setUserLimits(uid, overrides) {
  if (!uid) throw new Error('uid is required');

  const current = getLimitsForUser(uid);
  const merged = {
    messagesPerHour: overrides.messagesPerHour ?? current.messagesPerHour,
    sessionsPerDay: overrides.sessionsPerDay ?? current.sessionsPerDay,
  };

  userOverrides.set(uid, merged);
  return merged;
}

/**
 * Get the current effective limits for a user.
 * @param {string} uid
 * @returns {{ messagesPerHour: number, sessionsPerDay: number }}
 */
export function getUserLimits(uid) {
  return getLimitsForUser(uid);
}

/**
 * Reset a user's rate limit counters (useful for admin/testing).
 * @param {string} uid
 */
export function resetUserCounters(uid) {
  messageTimestamps.delete(uid);
  const sessions = dailySessions.get(uid);
  if (sessions) sessions.clear();

  if (db) {
    db.collection('rateLimits').doc(uid).delete().catch(() => {});
  }
}

// ─── Utility ─────────────────────────────────────────────────

function getSecondsUntilMidnightUTC() {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0
  ));
  return Math.ceil((midnight - now) / 1000);
}

// ─── Internals export for testing ────────────────────────────
export const _internals = {
  DEFAULT_LIMITS,
  messageTimestamps,
  dailySessions,
  userOverrides,
  pruneOldTimestamps,
  resetDailyIfNeeded,
  getLimitsForUser,
  getSecondsUntilMidnightUTC,
};