import { jest } from '@jest/globals';

// 1. Mock personalityService
const mockSaveUserCustom = jest.fn();
jest.unstable_mockModule('../src/services/personalityService.js', () => ({
  personalityService: {
    saveUserCustom: mockSaveUserCustom,
  }
}));

// 2. Mock personaManager
const mockGetPersonaById = jest.fn();
jest.unstable_mockModule('../src/personaManager.js', () => ({
  getPersonaById: mockGetPersonaById,
  listPersonas: jest.fn()
}));

describe('Custom Therapist Creation Options Routing', () => {
  let router;
  let postHandler;
  let getByIdHandler;

  beforeAll(async () => {
    // Import router after mocking dependencies
    const module = await import('../src/routes/personalities.js');
    router = module.default;

    // Find the handlers registered in the router stack
    const postRoute = router.stack.find(
      layer => layer.route && layer.route.path === '/' && layer.route.methods.post
    );
    postHandler = postRoute.route.stack[0].handle;

    const getByIdRoute = router.stack.find(
      layer => layer.route && layer.route.path === '/:id' && layer.route.methods.get
    );
    getByIdHandler = getByIdRoute.route.stack[0].handle;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /personalities (Create Custom Therapist)', () => {
    test('successfully generates custom therapist from structured options', async () => {
      const mockUser = { uid: 'user-123' };
      const req = {
        user: mockUser,
        body: {
          name: 'ZenMaster',
          avatarAsset: 'assets/avatars/zen.png',
          traits: ['Calm', 'Friendly'],
          tone: 'Balanced',
          depth: 'Medium',
          style: 'Coach',
          backstory: 'A mindful guru who promotes meditation.'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      // Mock saveUserCustom success
      mockSaveUserCustom.mockImplementation(async (uid, id, data) => {
        return { id, ...data };
      });

      await postHandler(req, res);

      // Verify saveUserCustom was called with correct data
      expect(mockSaveUserCustom).toHaveBeenCalledTimes(1);
      const [uidArg, idArg, dataArg] = mockSaveUserCustom.mock.calls[0];

      expect(uidArg).toBe('user-123');
      expect(idArg).toMatch(/^custom-\d+-\d+$/);
      expect(dataArg.name).toBe('ZenMaster');
      expect(dataArg.avatarAsset).toBe('assets/avatars/zen.png');
      expect(dataArg.tone).toBe('Balanced');
      expect(dataArg.depth).toBe('Medium');
      expect(dataArg.traits).toEqual(['Calm', 'Friendly']);
      expect(dataArg.backstory).toBe('A mindful guru who promotes meditation.');
      
      // Prompt should contain traits, tone, depth, style descriptions, and backstory
      expect(dataArg.personalityPrompt).toContain('ZenMaster');
      expect(dataArg.personalityPrompt).toContain('Calm: Serene, steady, and tranquil');
      expect(dataArg.personalityPrompt).toContain('Friendly: Warm, approachable');
      expect(dataArg.personalityPrompt).toContain('Balanced (calm, measured');
      expect(dataArg.personalityPrompt).toContain('Coach (focus on growth');
      expect(dataArg.personalityPrompt).toContain('A mindful guru who promotes meditation.');

      // Greeting should match the Coach style
      expect(dataArg.initialMessage).toContain('ZenMaster');
      expect(dataArg.initialMessage).toContain("Let's work together to set goals");

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    test('backward compatibility: accepts direct raw personalityPrompt and initialMessage', async () => {
      const mockUser = { uid: 'user-123' };
      const req = {
        user: mockUser,
        body: {
          name: 'OldSchool',
          personalityPrompt: 'You are an old school robot.',
          initialMessage: 'Beep boop.',
          avatarAsset: 'assets/avatars/robot.png'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      mockSaveUserCustom.mockImplementation(async (uid, id, data) => {
        return { id, ...data };
      });

      await postHandler(req, res);

      expect(mockSaveUserCustom).toHaveBeenCalledTimes(1);
      const [,, dataArg] = mockSaveUserCustom.mock.calls[0];
      
      expect(dataArg.name).toBe('OldSchool');
      expect(dataArg.personalityPrompt).toBe('You are an old school robot.');
      expect(dataArg.initialMessage).toBe('Beep boop.');
      expect(dataArg.avatarAsset).toBe('assets/avatars/robot.png');

      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('fails if name is missing', async () => {
      const req = {
        user: { uid: 'user-123' },
        body: {
          traits: ['Calm']
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await postHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required field: name is required.' });
      expect(mockSaveUserCustom).not.toHaveBeenCalled();
    });

    test('fails if unauthorized', async () => {
      const req = {
        body: {
          name: 'Anonymous'
        }
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await postHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized. Login required to create custom companion.' });
      expect(mockSaveUserCustom).not.toHaveBeenCalled();
    });
  });

  describe('GET /personalities/:id', () => {
    test('successfully fetches structured persona details', async () => {
      const req = {
        user: { uid: 'user-123' },
        params: { id: 'custom-123' }
      };

      const res = {
        json: jest.fn()
      };

      const mockPersona = {
        id: 'custom-123',
        name: 'ZenMaster',
        initialMessage: 'Namaste',
        style: 'Coach',
        tone: 'Balanced',
        depth: 'Medium',
        traits: ['Calm', 'Friendly'],
        backstory: 'A mindful therapist',
        avatarAsset: 'assets/zen.png'
      };

      mockGetPersonaById.mockResolvedValue(mockPersona);

      await getByIdHandler(req, res);

      expect(mockGetPersonaById).toHaveBeenCalledWith('custom-123', 'user-123');
      expect(res.json).toHaveBeenCalledWith({
        id: 'custom-123',
        name: 'ZenMaster',
        greeting: 'Namaste',
        style: 'Coach',
        tone: 'Balanced',
        depth: 'Medium',
        traits: ['Calm', 'Friendly'],
        backstory: 'A mindful therapist',
        avatarAsset: 'assets/zen.png'
      });
    });

    test('returns default values for non-structured or default fallback personas', async () => {
      const req = {
        user: { uid: 'user-123' },
        params: { id: 'empathic-listener' }
      };

      const res = {
        json: jest.fn()
      };

      const mockPersona = {
        id: 'empathic-listener',
        name: 'Empathic Listener',
        initialMessage: 'How are you feeling?',
        style: 'Gentle',
        tone: 'Warm',
        avatarAsset: 'assets/empathic.png'
      };

      mockGetPersonaById.mockResolvedValue(mockPersona);

      await getByIdHandler(req, res);

      expect(res.json).toHaveBeenCalledWith({
        id: 'empathic-listener',
        name: 'Empathic Listener',
        greeting: 'How are you feeling?',
        style: 'Gentle',
        tone: 'Warm',
        depth: 'Medium', // default fallback
        traits: [], // default fallback
        backstory: '', // default fallback
        avatarAsset: 'assets/empathic.png'
      });
    });
  });
});
