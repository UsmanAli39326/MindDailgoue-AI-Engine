// ─────────────────────────────────────────────────────────────
// memory.js (routes)
// Memory management API for settings UI and GDPR.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

/**
 * GET /memory — list user's memory blobs (for settings UI)
 */
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const snapshot = await db.collection('users').doc(uid).collection('memory')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const { decrypt } = await import('../services/encryptionService.js');

    const memories = snapshot.docs.map(doc => {
      const data = doc.data();
      let decryptedSummary = data.summary;

      if (data.iv) {
        try {
          decryptedSummary = decrypt(data.summary, data.iv);
        } catch (error) {
          // Retain ciphertext on failure
        }
      }

      return {
        id: doc.id,
        summary: decryptedSummary,
        themes: data.themes || [],
        createdAt: data.createdAt,
        sessionId: data.sessionId,
      };
    });

    res.json({ memories, count: memories.length });
  } catch (error) {
    console.error('[MEMORY ROUTE] List error:', error);
    res.status(500).json({ error: 'Failed to list memories' });
  }
});

/**
 * DELETE /memory — clear all user memory (GDPR right to erase)
 */
router.delete('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const snapshot = await db.collection('users').doc(uid).collection('memory').get();

    if (snapshot.empty) {
      return res.json({ message: 'No memories to delete', deleted: 0 });
    }

    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[MEMORY ROUTE] Deleted ${snapshot.size} memory blobs for user ${uid}`);
    res.json({ message: 'All memories deleted successfully', deleted: snapshot.size });
  } catch (error) {
    console.error('[MEMORY ROUTE] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete memories' });
  }
});

export default router;
