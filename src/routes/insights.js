// ─────────────────────────────────────────────────────────────
// insights.js (routes)
// Endpoint to fetch the latest daily insight for a user.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

/**
 * GET /insights/latest
 * Returns the most recently generated daily insight for the user.
 */
router.get('/latest', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    if (!db) {
      return res.status(503).json({ error: 'Firestore not available' });
    }

    const doc = await db.collection('users').doc(uid).collection('insights').doc('latest').get();

    if (!doc.exists) {
      return res.json({
        insight: null,
        message: 'No insights generated yet. Keep chatting and check back tomorrow!'
      });
    }

    res.json(doc.data());
  } catch (error) {
    console.error('[INSIGHTS ROUTE] Error:', error);
    res.status(500).json({ error: 'Failed to fetch insight' });
  }
});

export default router;
