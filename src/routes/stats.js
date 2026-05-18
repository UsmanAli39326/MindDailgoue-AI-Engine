// ─────────────────────────────────────────────────────────────
// stats.js (routes)
// Unified user profile engagement stats endpoint.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { getUnifiedStats } from '../services/statsAggregator.js';

const router = express.Router();

/**
 * GET /stats — Returns compiled dashboard analytics, streaks, and award badges.
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const stats = await getUnifiedStats(uid);
    res.json(stats);
  } catch (error) {
    console.error('[STATS ROUTE] Unified stats error:', error);
    res.status(500).json({ error: 'Failed to fetch user stats dashboard' });
  }
});

export default router;
