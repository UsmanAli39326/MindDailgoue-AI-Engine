// ─────────────────────────────────────────────────────────────
// appCheck.test.js
// Tests for Firebase App Check verification middleware.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { verifyAppCheck } from '../src/middleware/appCheck.js';

describe('appCheck middleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    req = {
      header: jest.fn(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    
    // Clear environment overrides
    delete process.env.NODE_ENV;
    delete process.env.BYPASS_APP_CHECK;
  });

  test('bypasses validation if NODE_ENV is development', async () => {
    process.env.NODE_ENV = 'development';
    
    await verifyAppCheck(req, res, next);
    
    expect(next).toHaveBeenCalled();
    expect(req.header).not.toHaveBeenCalled();
  });

  test('bypasses validation if BYPASS_APP_CHECK is true', async () => {
    process.env.BYPASS_APP_CHECK = 'true';
    
    await verifyAppCheck(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });

  test('returns 401 if token header is missing in production environment', async () => {
    process.env.NODE_ENV = 'production';
    req.header.mockReturnValue(null);

    await verifyAppCheck(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing App Check token' });
    expect(next).not.toHaveBeenCalled();
  });
});
