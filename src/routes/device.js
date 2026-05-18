// ─────────────────────────────────────────────────────────────
// device.js (routes)
// Device and FCM Token registration endpoint.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';
import { FieldValue } from 'firebase-admin/firestore';

const router = express.Router();

/**
 * POST /auth/device — store FCM token in /users/{uid}/fcmTokens
 */
router.post('/device', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { token, deviceType } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Missing required field: token' });
    }

    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const docRef = db.collection('users').doc(uid).collection('fcmTokens').doc(token);

    await docRef.set({
      token,
      deviceType: deviceType || 'unknown',
      lastUpdated: new Date().toISOString(),
    });

    console.log(`[DEVICE] Registered FCM Token for user ${uid}`);
    res.status(201).json({ message: 'Device registered successfully', token });
  } catch (error) {
    console.error('[DEVICE ROUTE] Registration error:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

export default router;
