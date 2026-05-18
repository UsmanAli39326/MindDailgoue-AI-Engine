// ─────────────────────────────────────────────────────────────
// themes.js (routes)
// Theme tracking API.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { getTopThemes, getThemeProfile } from '../services/themeTracker.js';

const router = express.Router();

/**
 * GET /themes — returns top themes with frequency
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const topThemes = await getTopThemes(uid, limit);

    res.json({ themes: topThemes });
  } catch (error) {
    console.error('[THEMES ROUTE] Error:', error);
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

export default router;
