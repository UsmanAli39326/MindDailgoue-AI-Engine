// ─────────────────────────────────────────────────────────────
// messages.js (routes)
// Encrypted message storage endpoints.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { storeEncryptedMessage, storeBatchMessages } from '../services/encryptedStorage.js';

const router = express.Router();

/**
 * POST /messages — store a single encrypted message
 */
router.post('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { ciphertext, iv, sessionId, role, client_id } = req.body;

    if (!ciphertext || !iv || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: ciphertext, iv, sessionId',
      });
    }

    const result = await storeEncryptedMessage(uid, { ciphertext, iv, sessionId, role, client_id });

    if (!result) {
      return res.status(500).json({ error: 'Failed to store message' });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('[MESSAGES ROUTE] Store error:', error);
    res.status(500).json({ error: 'Failed to store message' });
  }
});

/**
 * POST /messages/batch — offline sync: accepts array with client_id
 */
router.post('/batch', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages must be a non-empty array' });
    }

    if (messages.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 messages per batch' });
    }

    const results = await storeBatchMessages(uid, messages);
    res.json({ results, processed: results.length });
  } catch (error) {
    console.error('[MESSAGES ROUTE] Batch error:', error);
    res.status(500).json({ error: 'Failed to process batch' });
  }
});

export default router;
