import express from 'express';
import { executePhase3 } from '../executionPipelinePhase3.js';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { sessionId, therapistId, input } = req.body;
    const uid = req.user?.uid;
    
    console.log(`[CHAT ROUTE] Processing request: Session=${sessionId}, Therapist=${therapistId}, UID=${uid}`);
    
    if (!sessionId || !therapistId || !input) {
      return res.status(400).json({ 
        error: 'Missing required fields: sessionId, therapistId, input' 
      });
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
