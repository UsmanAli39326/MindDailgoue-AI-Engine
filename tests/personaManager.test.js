import { jest } from '@jest/globals';

// Mock personalityService BEFORE importing personaManager.js
jest.unstable_mockModule('../src/services/personalityService.js', () => ({
  personalityService: {
    getAll: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue(null),
    getUserCustomAll: jest.fn().mockResolvedValue([]),
    getUserCustomById: jest.fn().mockResolvedValue(null),
  }
}));

describe('personaManager', () => {
  let getPersonaById;
  let listPersonas;

  beforeAll(async () => {
    const manager = await import('../src/personaManager.js');
    getPersonaById = manager.getPersonaById;
    listPersonas = manager.listPersonas;
  });

  describe('getPersonaById', () => {
    test('returns correct persona by ID', async () => {
      const p = await getPersonaById('empathic-listener');
      expect(p.id).toBe('empathic-listener');
      expect(p.name).toBe('Empathic Listener');
      expect(p.avatarAsset).toBe('https://cdn-icons-png.flaticon.com/512/4140/4140037.png');
      expect(p.style).toBeDefined();
      expect(p.tone).toBeDefined();
      expect(p.personalityPrompt).toBeDefined();
    });

    test('returned object is frozen to prevent mutation', async () => {
      const p = await getPersonaById('motivator');
      expect(Object.isFrozen(p)).toBe(true);
      expect(() => {
        p.name = 'Hacked';
      }).toThrow();
    });

    test('throws if ID is not found', async () => {
      await expect(getPersonaById('non-existent-id')).rejects.toThrow(
        /Persona "non-existent-id" not found/
      );
    });

    test('throws if ID is invalid type', async () => {
      await expect(getPersonaById('')).rejects.toThrow('Persona ID must be a non-empty string.');
      await expect(getPersonaById(123)).rejects.toThrow('Persona ID must be a non-empty string.');
    });
  });

  describe('listPersonas', () => {
    test('returns array of all personas', async () => {
      const all = await listPersonas();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(6);
      
      const ids = all.map(p => p.id);
      expect(ids).toContain('empathic-listener');
      expect(ids).toContain('motivator');
      expect(ids).toContain('mindful-coach');
      expect(ids).toContain('cognitive-therapist');
      expect(ids).toContain('friendly-buddy');
      expect(ids).toContain('calm-monk');
    });

    test('returned array contains frozen objects', async () => {
      const all = await listPersonas();
      expect(Object.isFrozen(all[0])).toBe(true);
    });
  });
});
