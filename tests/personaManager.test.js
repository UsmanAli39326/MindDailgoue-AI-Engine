import { getPersonaById, listPersonas } from '../src/personaManager.js';

describe('personaManager', () => {
  describe('getPersonaById', () => {
    test('returns correct persona by ID', () => {
      const p = getPersonaById('compassionate-listener');
      expect(p.id).toBe('compassionate-listener');
      expect(p.name).toBe('Dr. Amara');
      expect(p.style).toBeDefined();
      expect(p.tone).toBeDefined();
      expect(p.personalityPrompt).toBeDefined();
    });

    test('returned object is frozen to prevent mutation', () => {
      const p = getPersonaById('growth-coach');
      expect(Object.isFrozen(p)).toBe(true);
      expect(() => {
        p.name = 'Hacked';
      }).toThrow();
    });

    test('throws if ID is not found', () => {
      expect(() => getPersonaById('non-existent-id')).toThrow(/Persona "non-existent-id" not found/);
    });

    test('throws if ID is invalid type', () => {
      expect(() => getPersonaById('')).toThrow('Persona ID must be a non-empty string.');
      expect(() => getPersonaById(123)).toThrow('Persona ID must be a non-empty string.');
    });
  });

  describe('listPersonas', () => {
    test('returns array of all personas', () => {
      const all = listPersonas();
      expect(Array.isArray(all)).toBe(true);
      expect(all.length).toBeGreaterThanOrEqual(3);
      
      const ids = all.map(p => p.id);
      expect(ids).toContain('compassionate-listener');
      expect(ids).toContain('growth-coach');
      expect(ids).toContain('mindfulness-guide');
    });

    test('returned array contains frozen objects', () => {
      const all = listPersonas();
      expect(Object.isFrozen(all[0])).toBe(true);
    });
  });
});
