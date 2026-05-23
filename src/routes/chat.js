import express from 'express';
import { executePhase3 } from '../executionPipelinePhase3.js';
import { db } from '../config/firebase.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { sessionId, therapistId, input } = req.body;
    const uid = req.user?.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`[CHAT ROUTE] Processing request: Session=${sessionId}, Therapist=${therapistId}, UID=${uid}`);

    if (!sessionId || !therapistId || !input) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, therapistId, input'
      });
    }

    // Session Ownership Validation
    if (db) {
      const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
      const sessionDoc = await sessionRef.get();
      if (!sessionDoc.exists) {
        console.warn(`[CHAT ROUTE] Unauthorized access attempt: UID=${uid} tried to access Session=${sessionId}`);
        return res.status(403).json({ error: 'Session not found or access denied.' });
      }
    }

    const result = await executePhase3({ sessionId, therapistId, input, uid });
    res.json(result);
  } catch (error) {
    console.error('[CHAT ROUTE] Error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
});

export default router;