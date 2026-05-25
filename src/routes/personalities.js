import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPersonaById, listPersonas } from '../personaManager.js';
import multer from 'multer';

const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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
      depth: persona.depth || 'Medium',
      traits: persona.traits || [],
      backstory: persona.backstory || '',
      avatarAsset: persona.avatarAsset
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Helper descriptions for prompt generation from structured options
const TRAIT_DESCRIPTIONS = {
  Calm: 'Calm: Serene, steady, and tranquil. Help the user find their center, breathe slowly, and feel grounded.',
  Logical: 'Logical: Structured, analytical, and objective. Help the user break down problems, analyze thoughts, and identify cognitive distortions logically.',
  Friendly: 'Friendly: Warm, approachable, kind, and supportive. Treat the user with the familiarity of a deeply caring buddy.',
  Strict: 'Strict: High accountability, tough love, and direct honesty. Call out avoidance patterns and challenge the user to face realities directly.',
  Motivational: 'Motivational: High-energy, encouraging, and positive. Focus on progress, building momentum, and driving active, constructive steps forward.',
  Empathetic: 'Empathetic: Warm, highly validating, and active listening. Validate every emotion without judgment and sit with the user in their feelings.'
};

const TONE_DESCRIPTIONS = {
  Emotional: 'Emotional (deeply feeling, highly expressive, warm, and validation-focused. Show that you feel their joy or pain with genuine care)',
  Balanced: 'Balanced (calm, measured, and objective. Blend logical reasoning with emotional validation perfectly)',
  Rational: 'Rational (objective, intellectual, and clinical. Keep emotional expressions minimized, focusing on clarity, logic, and analytical insight)'
};

const DEPTH_DESCRIPTIONS = {
  Short: 'Short (keep responses extremely brief, punchy, and concise. Maximum 15-20 words per response)',
  Medium: 'Medium (keep responses to a standard therapeutic length. Maximum 30-40 words per response)',
  Deep: 'Deep (provide highly detailed, reflective, and immersive responses. Explore complex thoughts, offering profound observations. Limit to 60-70 words)'
};

const STYLE_DESCRIPTIONS = {
  Advice: 'Advice (focus on action-oriented advice, guidance, suggestions, and practical techniques the user can try)',
  Listener: 'Listener (focus purely on active listening, reflection, and validating the user\'s feelings without offering unsolicited solutions or advice)',
  Coach: 'Coach (focus on growth, empowerment, asking challenging questions, goal-setting, and helping the user unlock their own answers)'
};

function generatePromptAndGreeting({ name, traits = [], tone = 'Balanced', depth = 'Medium', style = 'Listener', backstory = '' }) {
  const selectedTraits = traits
    .map(t => TRAIT_DESCRIPTIONS[t] || `${t}: Express this quality in your dialogue.`)
    .join('\n- ');

  const toneDesc = TONE_DESCRIPTIONS[tone] || tone;
  const depthDesc = DEPTH_DESCRIPTIONS[depth] || depth;
  const styleDesc = STYLE_DESCRIPTIONS[style] || style;

  const personalityPrompt = [
    `You are ${name}, a private companion therapist.`,
    `Your approach is built on the following core traits:`,
    selectedTraits ? `- ${selectedTraits}` : `- Supportive: Friendly, empathetic, and helpful.`,
    ``,
    `Your response style:`,
    `- Tone: ${toneDesc}`,
    `- Depth: ${depthDesc}`,
    `- Style: ${styleDesc}`,
    backstory ? `\nYour backstory and clinical approach:\n"${backstory}"` : '',
    ``,
    `Instructions:`,
    `1. Always stay in character as ${name}.`,
    `2. Prioritize being empathetic and warm.`,
    `3. Align strictly with your designated Tone, Depth, and Style.`
  ].filter(line => line !== null).join('\n');

  let initialMessage = `Hello. I'm ${name}, your companion therapist. I'm here to support you in any way you need. *How are you feeling today?*`;
  if (style === 'Advice') {
    initialMessage = `Hi, I'm ${name}. I'm here to offer warm guidance, practical advice, and helpful strategies. *What challenges can I help you tackle today?*`;
  } else if (style === 'Listener') {
    initialMessage = `Hello, I'm ${name}. I'm here to listen to you with warmth, care, and full presence. *What is on your mind today?*`;
  } else if (style === 'Coach') {
    initialMessage = `Hi there! I'm ${name}. Let's work together to set goals, build momentum, and grow. *What shall we focus on today?*`;
  }

  return { personalityPrompt, initialMessage };
}

// POST /personalities - Create a custom private persona for this user
router.post('/', upload.single('avatar'), async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized. Login required to create custom companion.' });
    }

    let {
      name,
      avatarAsset,
      traits = [],
      tone = 'Balanced',
      depth = 'Medium',
      style = 'Listener',
      backstory = '',
      personalityPrompt: rawPrompt,
      initialMessage: rawInitialMessage
    } = req.body;

    // Handle form-data strings
    if (typeof traits === 'string') {
      try {
        traits = JSON.parse(traits);
      } catch (e) {
        traits = traits.split(',').map(t => t.trim());
      }
    }

    if (!name) {
      return res.status(400).json({ error: 'Missing required field: name is required.' });
    }

    // Convert uploaded file to base64 if present
    let finalAvatarAsset = avatarAsset;
    if (req.file) {
      const b64 = req.file.buffer.toString('base64');
      finalAvatarAsset = `data:${req.file.mimetype};base64,${b64}`;
    }

    // Fallback to generic doctor avatar
    if (!finalAvatarAsset) {
      finalAvatarAsset = '/assets/avatars/dr_fallback.png';
    }

    let finalPrompt = rawPrompt;
    let finalInitialMessage = rawInitialMessage;
    let finalStyle = style || 'Custom companion';
    let finalTone = tone || 'Balanced';

    // If structured fields are provided, generate prompt and message
    if (!finalPrompt || !finalInitialMessage) {
      const generated = generatePromptAndGreeting({
        name,
        traits,
        tone,
        depth,
        style,
        backstory
      });
      finalPrompt = finalPrompt || generated.personalityPrompt;
      finalInitialMessage = finalInitialMessage || generated.initialMessage;
    }

    const { personalityService } = await import('../services/personalityService.js');
    
    // Generate unique ID for this custom persona
    const id = `custom-${uuidv4()}`;

    const newPersona = {
      name,
      style: finalStyle,
      tone: finalTone,
      depth,
      traits,
      backstory,
      personalityPrompt: finalPrompt,
      initialMessage: finalInitialMessage,
      avatarAsset: finalAvatarAsset
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
