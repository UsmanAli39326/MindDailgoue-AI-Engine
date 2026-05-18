// ─────────────────────────────────────────────────────────────
// auth.js (routes)
// Authentication management: register, login
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /auth/register
 * Registers a new user via Firebase Identity Toolkit
 */
router.post('/register', async (req, res) => {
  const { email, password, name, background } = req.body;
  const apiKey = process.env.FIREBASE_API_KEY;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Auth: FIREBASE_API_KEY missing in development. Mocking successful register.');
      return res.status(201).json({
        uid: 'dev-user-123',
        idToken: 'dev-user-123', // Special token that bypasses verifyToken
        refreshToken: 'mock-refresh',
        email: email
      });
    }
    return res.status(500).json({ error: 'Server misconfiguration: FIREBASE_API_KEY is missing' });
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error.message || 'Failed to register' });
    }

    const uid = data.localId;

    // Save basic profile info to Firestore if provided
    if (db && (name || background)) {
      try {
        await db.collection('users').doc(uid).set({
          name: name || null,
          background: background || null,
          createdAt: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr) {
        console.error('[AUTH ROUTE] Failed to save user profile:', dbErr.message);
      }
    }

    res.status(201).json({
      uid: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email
    });
  } catch (error) {
    console.error('[AUTH ROUTE] Register error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /auth/login
 * Logs in a user via Firebase Identity Toolkit
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const apiKey = process.env.FIREBASE_API_KEY;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Auth: FIREBASE_API_KEY missing in development. Mocking successful login.');
      return res.json({
        uid: 'dev-user-123',
        idToken: 'dev-user-123', // Special token that bypasses verifyToken
        refreshToken: 'mock-refresh',
        email: email
      });
    }
    return res.status(500).json({ error: 'Server misconfiguration: FIREBASE_API_KEY is missing' });
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error.message || 'Failed to login' });
    }

    res.json({
      uid: data.localId,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      email: data.email
    });
  } catch (error) {
    console.error('[AUTH ROUTE] Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * POST /auth/logout
 * Logs out a user and removes their specific device token
 * so they stop receiving push notifications on that device.
 */
router.post('/logout', verifyToken, async (req, res) => {
  const { fcmToken } = req.body;
  const uid = req.user.uid;

  if (fcmToken && db) {
    try {
      await db.collection('users').doc(uid).collection('fcmTokens').doc(fcmToken).delete();
      console.log(`[AUTH ROUTE] Removed FCM token for user ${uid} on logout`);
    } catch (error) {
      console.error('[AUTH ROUTE] Failed to remove FCM token on logout:', error.message);
      // We don't fail the logout if token removal fails
    }
  }

  res.json({ message: 'Logged out successfully' });
});

export default router;
