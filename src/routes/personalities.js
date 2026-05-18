import express from 'express';
import { getPersonaById, listPersonas } from '../personaManager.js';

const router = express.Router();

// Existing logic for getting therapist initial message
// Ported from GET /therapist/initial-message?id=
router.get('/initial-message', async (req, res) => {
  const therapistId = req.query.id;

  if (!therapistId) {
    return res.status(400).json({ error: 'Missing therapist id parameter' });
  }

  try {
    const persona = await getPersonaById(therapistId);
    res.json({ 
      therapistId: persona.id,
      name: persona.name,
      initialMessage: persona.initialMessage 
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// T1.D.4 list all personalities
router.get('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    const personalities = await listPersonas(uid);
    res.json(personalities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch personalities' });
  }
});

// GET /personalities/:id
router.get('/:id', async (req, res) => {
  try {
    const uid = req.user?.uid;
    const persona = await getPersonaById(req.params.id, uid);
    res.json({
      id: persona.id,
      name: persona.name,
      greeting: persona.initialMessage || persona.greeting,
      style: persona.style,
      tone: persona.tone,
      avatarAsset: persona.avatarAsset
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// POST /personalities - Create a custom private persona for this user
router.post('/', async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized. Login required to create custom companion.' });
    }

    const { name, style, tone, personalityPrompt, initialMessage, avatarAsset } = req.body;

    if (!name || !personalityPrompt || !initialMessage) {
      return res.status(400).json({ error: 'Missing required fields: name, personalityPrompt, and initialMessage are required.' });
    }

    const { personalityService } = await import('../services/personalityService.js');
    
    // Generate unique ID for this custom persona
    const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newPersona = {
      name,
      style: style || 'Custom counselor',
      tone: tone || 'Understanding',
      personalityPrompt,
      initialMessage,
      avatarAsset: avatarAsset || 'assets/avatars/friendly.png'
    };

    const saved = await personalityService.saveUserCustom(uid, id, newPersona);
    if (!saved) {
      return res.status(500).json({ error: 'Failed to save custom personality' });
    }

    res.status(201).json(saved);
  } catch (error) {
    console.error('[PERSONALITIES ROUTE] Create error:', error);
    res.status(500).json({ error: 'Failed to create custom personality' });
  }
});

export default router;
