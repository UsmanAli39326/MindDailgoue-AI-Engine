// ─────────────────────────────────────────────────────────────
// requestLogger.test.js
// Tests for request logger structured JSON audits and hashing.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { requestLogger } from '../src/middleware/requestLogger.js';

describe('requestLogger', () => {
  let req;
  let res;
  let next;
  let consoleSpy;

  beforeEach(() => {
    req = {
      method: 'GET',
      baseUrl: '/api',
      path: '/v1/test',
      user: { uid: 'auth-user-123' },
      get: jest.fn().mockReturnValue('mock-agent'),
    };
    
    // Simulate Express response lifecycle hooks
    const listeners = {};
    res = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event, callback) => {
        listeners[event] = callback;
      }),
      emitFinish: () => {
        if (listeners['finish']) {
          listeners['finish']();
        }
      }
    };
    
    next = jest.fn();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('successfully triggers next() immediately', () => {
    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('produces structured JSON entry on response finish', () => {
    requestLogger(req, res, next);
    res.emitFinish();

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    
    // Verify output is a valid JSON string
    let parsedLog;
    expect(() => {
      parsedLog = JSON.parse(logOutput);
    }).not.toThrow();

    expect(parsedLog.method).toBe('GET');
    expect(parsedLog.path).toBe('/api/v1/test');
    expect(parsedLog.statusCode).toBe(200);
    expect(parsedLog.durationMs).toBeDefined();
    
    // Auth uid must be hashed to preserve privacy
    expect(parsedLog.uidHash).not.toBe('auth-user-123');
    expect(parsedLog.uidHash).toHaveLength(16); // SHA-256 slice length
  });

  test('handles anonymous/unauthenticated sessions gracefully', () => {
    delete req.user;
    requestLogger(req, res, next);
    res.emitFinish();

    const parsedLog = JSON.parse(consoleSpy.mock.calls[0][0]);
    expect(parsedLog.uidHash).toBe('anonymous');
  });
});
