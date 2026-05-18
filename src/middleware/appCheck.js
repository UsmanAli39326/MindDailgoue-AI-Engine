// ─────────────────────────────────────────────────────────────
// appCheck.js
// Firebase App Check middleware.
// Attests client request legitimacy to prevent scraping/unauthorized API use.
// Passes through in development environments.
// ─────────────────────────────────────────────────────────────

import { adminApp } from '../config/firebase.js';
import admin from 'firebase-admin';

/**
 * Express middleware for Firebase App Check validation.
 */
export async function verifyAppCheck(req, res, next) {
  // Allow bypassing App Check validation in local development
  if (process.env.NODE_ENV === 'development' || process.env.BYPASS_APP_CHECK === 'true') {
    return next();
  }

  const appCheckToken = req.header('X-Firebase-AppCheck');

  if (!appCheckToken) {
    return res.status(401).json({ error: 'Unauthorized: Missing App Check token' });
  }

  try {
    const appCheck = admin.appCheck(adminApp);
    const decodedToken = await appCheck.verifyToken(appCheckToken);
    
    // Attest token details if required
    req.appId = decodedToken.appId;
    next();
  } catch (error) {
    console.error('[APP CHECK] Verification failed:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid App Check token' });
  }
}
