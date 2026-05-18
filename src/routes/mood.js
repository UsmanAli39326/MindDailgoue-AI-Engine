// ─────────────────────────────────────────────────────────────
// mood.js (routes)
// Analytics endpoints for mood data.
// All scoped to authenticated user via auth middleware.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { getMoodLogs } from '../services/moodService.js';
import { buildTimeline, buildHeatmap, buildSummary } from '../services/moodAggregation.js';

const router = express.Router();

/**
 * GET /mood/timeline?days=30
 * Returns daily emotion arrays sorted by time.
 */
router.get('/timeline', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const days = Math.min(parseInt(req.query.days) || 30, 90); // cap at 90
    const logs = await getMoodLogs(uid, days);
    const timeline = buildTimeline(logs);

    res.json({ days, timeline });
  } catch (error) {
    console.error('[MOOD ROUTE] Timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch mood timeline' });
  }
});

/**
 * GET /mood/heatmap?weeks=12
 * Returns { date, avg_stress } for calendar heatmap.
 */
router.get('/heatmap', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const weeks = Math.min(parseInt(req.query.weeks) || 12, 52); // cap at 52
    const days = weeks * 7;
    const logs = await getMoodLogs(uid, days);
    const heatmap = buildHeatmap(logs);

    res.json({ weeks, heatmap });
  } catch (error) {
    console.error('[MOOD ROUTE] Heatmap error:', error);
    res.status(500).json({ error: 'Failed to fetch mood heatmap' });
  }
});

/**
 * GET /mood/summary
 * Returns weekly emotion breakdown (percentages).
 */
router.get('/summary', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const logs = await getMoodLogs(uid, 7);
    const summary = buildSummary(logs);

    res.json(summary);
  } catch (error) {
    console.error('[MOOD ROUTE] Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch mood summary' });
  }
});

export default router;
