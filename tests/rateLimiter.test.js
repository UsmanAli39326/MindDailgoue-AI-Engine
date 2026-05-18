// ─────────────────────────────────────────────────────────────
// rateLimiter.test.js
// Tests for the sliding-window rate limiter middleware.
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';
import {
  rateLimit,
  setUserLimits,
  getUserLimits,
  resetUserCounters,
  _internals,
} from '../src/middleware/rateLimiter.js';

// ─── Mock Express req/res/next ───────────────────────────────
function mockReq(uid, sessionId = 'session-1') {
  return {
    user: uid ? { uid } : undefined,
    body: { sessionId },
    method: 'POST',
    path: '/chat',
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('rateLimiter', () => {
  const TEST_UID = 'test-uid-rl';

  beforeEach(() => {
    // Clean up all state between tests
    resetUserCounters(TEST_UID);
    _internals.userOverrides.delete(TEST_UID);
  });

  // ─── Middleware: passes through normally ──────────────────
  describe('rateLimit middleware', () => {
    test('calls next() when under limits', async () => {
      const req = mockReq(TEST_UID);
      const res = mockRes();
      const next = jest.fn();

      await rateLimit(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });

    test('skips rate limiting if no uid', async () => {
      const req = mockReq(null);
      const res = mockRes();
      const next = jest.fn();

      await rateLimit(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    test('returns 429 when message limit exceeded', async () => {
      // Set a very low limit for testing
      setUserLimits(TEST_UID, { messagesPerHour: 3 });

      const next = jest.fn();

      // Send 3 messages (should all pass)
      for (let i = 0; i < 3; i++) {
        const req = mockReq(TEST_UID);
        const res = mockRes();
        await rateLimit(req, res, next);
      }
      expect(next).toHaveBeenCalledTimes(3);

      // 4th message should be blocked
      const req = mockReq(TEST_UID);
      const res = mockRes();
      await rateLimit(req, res, next);

      expect(next).toHaveBeenCalledTimes(3); // still 3
      expect(res.statusCode).toBe(429);
      expect(res.body.limitType).toBe('messages_per_hour');
      expect(res.body.retryAfter).toBeGreaterThan(0);
    });

    test('returns 429 when session limit exceeded', async () => {
      setUserLimits(TEST_UID, { sessionsPerDay: 2, messagesPerHour: 100 });

      const next = jest.fn();

      // Session 1
      await rateLimit(mockReq(TEST_UID, 'session-a'), mockRes(), next);
      // Session 2
      await rateLimit(mockReq(TEST_UID, 'session-b'), mockRes(), next);
      expect(next).toHaveBeenCalledTimes(2);

      // Session 3 — should be blocked
      const res = mockRes();
      await rateLimit(mockReq(TEST_UID, 'session-c'), res, next);

      expect(next).toHaveBeenCalledTimes(2); // still 2
      expect(res.statusCode).toBe(429);
      expect(res.body.limitType).toBe('sessions_per_day');
    });

    test('allows multiple messages in the same session without counting new sessions', async () => {
      setUserLimits(TEST_UID, { sessionsPerDay: 1, messagesPerHour: 100 });

      const next = jest.fn();

      // 5 messages all in session-a
      for (let i = 0; i < 5; i++) {
        await rateLimit(mockReq(TEST_UID, 'session-a'), mockRes(), next);
      }

      expect(next).toHaveBeenCalledTimes(5); // All pass — same session
    });
  });

  // ─── Admin: user limit overrides ──────────────────────────
  describe('setUserLimits / getUserLimits', () => {
    test('returns default limits for unknown user', () => {
      const limits = getUserLimits('unknown-uid');
      expect(limits.messagesPerHour).toBe(_internals.DEFAULT_LIMITS.messagesPerHour);
      expect(limits.sessionsPerDay).toBe(_internals.DEFAULT_LIMITS.sessionsPerDay);
    });

    test('overrides only specified fields', () => {
      setUserLimits(TEST_UID, { messagesPerHour: 120 });
      const limits = getUserLimits(TEST_UID);

      expect(limits.messagesPerHour).toBe(120);
      expect(limits.sessionsPerDay).toBe(_internals.DEFAULT_LIMITS.sessionsPerDay);
    });

    test('overrides both fields', () => {
      const result = setUserLimits(TEST_UID, { messagesPerHour: 200, sessionsPerDay: 10 });

      expect(result.messagesPerHour).toBe(200);
      expect(result.sessionsPerDay).toBe(10);
    });

    test('throws on missing uid', () => {
      expect(() => setUserLimits(null, {})).toThrow('uid is required');
    });
  });

  // ─── resetUserCounters ────────────────────────────────────
  describe('resetUserCounters', () => {
    test('clears message timestamps and session set', async () => {
      setUserLimits(TEST_UID, { messagesPerHour: 2 });

      const next = jest.fn();
      await rateLimit(mockReq(TEST_UID, 'session-x'), mockRes(), next);
      await rateLimit(mockReq(TEST_UID, 'session-x'), mockRes(), next);
      expect(next).toHaveBeenCalledTimes(2);

      // Should be blocked now
      const res1 = mockRes();
      await rateLimit(mockReq(TEST_UID, 'session-x'), res1, next);
      expect(res1.statusCode).toBe(429);

      // Reset
      resetUserCounters(TEST_UID);

      // Should pass again
      await rateLimit(mockReq(TEST_UID, 'session-x'), mockRes(), next);
      expect(next).toHaveBeenCalledTimes(3);
    });
  });

  // ─── Sliding window pruning ───────────────────────────────
  describe('sliding window', () => {
    test('old timestamps are pruned and do not count', async () => {
      setUserLimits(TEST_UID, { messagesPerHour: 2 });

      // Manually insert timestamps older than 1 hour
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      _internals.messageTimestamps.set(TEST_UID, [twoHoursAgo, twoHoursAgo]);

      const next = jest.fn();
      const res = mockRes();

      // Should pass — old timestamps should be pruned
      await rateLimit(mockReq(TEST_UID), res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });
  });
});
