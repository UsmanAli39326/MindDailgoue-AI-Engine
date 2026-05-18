import express from 'express';
import { setUserLimits, getUserLimits, resetUserCounters } from '../middleware/rateLimiter.js';
import { processCheckins } from '../services/notificationService.js';

const router = express.Router();

/**
 * POST /admin/limits
 * Set custom rate limits for a specific user tier.
 * Body: { uid, messagesPerHour?, sessionsPerDay? }
 * 
 * NOTE: In production, this should be protected by an admin-only
 * auth check (e.g., custom claims on the Firebase token).
 */


router.post('/limits', (req, res) => {
  try {
    const { uid, messagesPerHour, sessionsPerDay } = req.body;

    if (!uid) {
      return res.status(400).json({ error: 'Missing required field: uid' });
    }

    if (messagesPerHour !== undefined && (typeof messagesPerHour !== 'number' || messagesPerHour < 1)) {
      return res.status(400).json({ error: 'messagesPerHour must be a positive number' });
    }

    if (sessionsPerDay !== undefined && (typeof sessionsPerDay !== 'number' || sessionsPerDay < 1)) {
      return res.status(400).json({ error: 'sessionsPerDay must be a positive number' });
    }

    const updated = setUserLimits(uid, { messagesPerHour, sessionsPerDay });

    console.log(`[ADMIN] Updated rate limits for user ${uid}:`, updated);

    res.json({
      message: 'Rate limits updated successfully',
      uid,
      limits: updated,
    });
  } catch (error) {
    console.error('[ADMIN] Error updating limits:', error);
    res.status(500).json({ error: 'Failed to update limits' });
  }
});

/**
 * GET /admin/limits/:uid
 * Get the current effective limits for a user.
 */
router.get('/limits/:uid', (req, res) => {
  const { uid } = req.params;
  const limits = getUserLimits(uid);
  res.json({ uid, limits });
});

/**
 * POST /admin/limits/:uid/reset
 * Reset a user's rate limit counters.
 */
router.post('/limits/:uid/reset', (req, res) => {
  const { uid } = req.params;
  resetUserCounters(uid);
  console.log(`[ADMIN] Reset rate limit counters for user ${uid}`);
  res.json({ message: 'Counters reset successfully', uid });
});

/**
 * POST /admin/trigger-checkins
 * Triggers the background push notification check-in process.
 * Protected by X-Cron-Secret header.
 */
router.post('/trigger-checkins', (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET) {
     console.warn('⚠️ CRON_SECRET is not set in environment variables');
  } else if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
  }

  // Return 202 immediately to cron-job.org
  res.status(202).json({ message: 'Check-in process triggered' });

  // Run asynchronously
  processCheckins().catch(err => {
    console.error('[CRON TRIGGER] Background check-in failed:', err.message);
  });
});

export default router;
