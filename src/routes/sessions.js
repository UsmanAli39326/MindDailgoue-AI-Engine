// ─────────────────────────────────────────────────────────────
// sessions.js (routes)
// Session management: create, list, close, delete.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';
import { summarizeAndStore } from '../services/sessionSummarizer.js';
import { updateThemes } from '../services/themeTracker.js';
import { deleteSessionMessages } from '../services/encryptedStorage.js';
import { getRecentHistory } from '../memoryManager.js';

const router = express.Router();

/**
 * POST /sessions — start a new session
 */
router.post('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { therapistId } = req.body;
    if (!therapistId) {
      return res.status(400).json({ error: 'Missing required field: therapistId' });
    }

    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const sessionDoc = {
      therapistId,
      createdAt: new Date().toISOString(),
      status: 'active',
      messageCount: 0,
    };

    const ref = await db.collection('users').doc(uid).collection('sessions').add(sessionDoc);

    res.status(201).json({ sessionId: ref.id, ...sessionDoc });
  } catch (error) {
    console.error('[SESSIONS ROUTE] Create error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * GET /sessions — list all sessions
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const snapshot = await db.collection('users').doc(uid).collection('sessions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ sessions });
  } catch (error) {
    console.error('[SESSIONS ROUTE] List error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * POST /sessions/:id/close — close a session and trigger summarization
 */
router.post('/:id/close', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const sessionId = req.params.id;

    // Get recent history for summarization
    let history;
    try {
      history = getRecentHistory(sessionId);
    } catch {
      history = '';
    }

    const messages = history ? history.split('\n').filter(Boolean) : [];

    // Summarize and store
    let summaryResult = null;
    if (messages.length > 0) {
      summaryResult = await summarizeAndStore(uid, sessionId, messages);

      // Update theme tracker if themes were extracted
      if (summaryResult?.themes?.length > 0) {
        updateThemes(uid, summaryResult.themes);
      }
    }

    // Mark session as closed in Firestore
    await db.collection('users').doc(uid).collection('sessions').doc(sessionId).set(
      { status: 'closed', closedAt: new Date().toISOString() },
      { merge: true }
    );

    res.json({
      message: 'Session closed successfully',
      sessionId,
      summary: summaryResult,
    });
  } catch (error) {
    console.error('[SESSIONS ROUTE] Close error:', error);
    res.status(500).json({ error: 'Failed to close session' });
  }
});

/**
 * GET /sessions/:id/messages — paginated encrypted history
 */
router.get('/:id/messages', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const { getSessionMessages } = await import('../services/encryptedStorage.js');
    const sessionId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const startAfter = req.query.cursor || null;

    const result = await getSessionMessages(uid, sessionId, limit, startAfter);
    res.json(result);
  } catch (error) {
    console.error('[SESSIONS ROUTE] Messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * DELETE /sessions/:id — delete session + all messages
 */
router.delete('/:id', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const sessionId = req.params.id;

    // Delete encrypted messages
    await deleteSessionMessages(uid, sessionId);

    // Delete session document
    await db.collection('users').doc(uid).collection('sessions').doc(sessionId).delete();

    res.json({ message: 'Session deleted successfully', sessionId });
  } catch (error) {
    console.error('[SESSIONS ROUTE] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
