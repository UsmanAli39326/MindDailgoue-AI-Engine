// ─────────────────────────────────────────────────────────────
// account.js (routes)
// GDPR data export and full account erasure.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { db } from '../config/firebase.js';

const router = express.Router();

// Subcollections to include in export/erasure
const USER_SUBCOLLECTIONS = [
  'sessions',
  'messages',
  'memory',
  'moodLog',
  'insights',
  'themeProfile',
  'crisisLog',
];

/**
 * GET /export — GDPR data export (all user data as JSON)
 */
router.get('/export', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    const exportData = { uid, exportedAt: new Date().toISOString(), data: {} };

    for (const collection of USER_SUBCOLLECTIONS) {
      const snapshot = await db.collection('users').doc(uid).collection(collection).get();
      exportData.data[collection] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    }

    res.json(exportData);
  } catch (error) {
    console.error('[ACCOUNT ROUTE] Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * DELETE /account — full account erasure (delete all subcollections)
 */
router.delete('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(503).json({ error: 'Firestore not available' });

    let totalDeleted = 0;

    for (const collection of USER_SUBCOLLECTIONS) {
      const snapshot = await db.collection('users').doc(uid).collection(collection).get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        totalDeleted += snapshot.size;
      }
    }

    // Delete the user document itself
    await db.collection('users').doc(uid).delete();

    console.log(`[ACCOUNT ROUTE] Full erasure for user ${uid}: ${totalDeleted} documents deleted`);
    res.json({
      message: 'Account and all associated data deleted successfully',
      documentsDeleted: totalDeleted,
    });
  } catch (error) {
    console.error('[ACCOUNT ROUTE] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
