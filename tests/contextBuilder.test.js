import { buildMemoryContext, buildProfileContext } from '../src/contextBuilder.js';

describe('contextBuilder', () => {
  describe('buildMemoryContext', () => {
    test('returns empty string if no memories', () => {
      expect(buildMemoryContext([])).toBe('');
      expect(buildMemoryContext(null)).toBe('');
    });

    test('builds context correctly with memories', () => {
      const memories = [
        { text: 'Memory A' },
        { text: 'Memory B' }
      ];
      const result = buildMemoryContext(memories);
      expect(result).toContain('[RELEVANT PAST MEMORIES]');
      expect(result).toContain('[1] Memory A');
      expect(result).toContain('[2] Memory B');
    });
  });

  describe('buildProfileContext', () => {
    test('returns empty string if falsy profile', () => {
      expect(buildProfileContext(null)).toBe('');
    });

    test('builds string conditionally based on profile fields', () => {
      const profile1 = { dominantEmotion: 'sad' };
      const res1 = buildProfileContext(profile1);
      expect(res1).toContain('[USER PROFILE]');
      expect(res1).toContain('Dominant historical emotion: sad');
      expect(res1).not.toContain('Known stressors');

      const profile2 = { dominantEmotion: 'anxious', recurringThemes: ['work', 'health'] };
      const res2 = buildProfileContext(profile2);
      expect(res2).toContain('Dominant historical emotion: anxious');
      expect(res2).toContain('Known stressors/themes: work, health');
    });

    test('ignores neutral dominant emotion if no themes', () => {
       const profile = { dominantEmotion: 'neutral', recurringThemes: [] };
       expect(buildProfileContext(profile)).toBe('');
    });
  });
});
