import { getAdaptiveInstructions } from '../src/adaptiveResponseController.js';

describe('adaptiveResponseController', () => {
  test('returns empty if no profile', () => {
    expect(getAdaptiveInstructions(null)).toBe('');
  });

  test('returns empty if plain calm profile', () => {
    expect(getAdaptiveInstructions({ dominantEmotion: 'calm' })).toBe('');
  });

  test('adapts to anxious emotion', () => {
    const res = getAdaptiveInstructions({ dominantEmotion: 'anxious' });
    expect(res).toContain('[ADAPTIVE INSTRUCTIONS]');
    expect(res).toContain('slower, more reassuring conversational pace');
  });

  test('adapts to stressed emotion', () => {
    const res = getAdaptiveInstructions({ dominantEmotion: 'stressed' });
    expect(res).toContain('profound validation');
  });

  test('adapts to sad emotion', () => {
    const res = getAdaptiveInstructions({ dominantEmotion: 'sad' });
    expect(res).toContain('safe holding of their grief');
  });

  test('includes tone preference', () => {
    const res = getAdaptiveInstructions({ dominantEmotion: 'calm', tonePreference: 'direct' });
    expect(res).toContain('more structure and actionable framing');
  });

  test('guarantees constraint message', () => {
    const res = getAdaptiveInstructions({ dominantEmotion: 'sad' });
    expect(res).toContain('WITHOUT overriding your primary Therapist Identity');
  });
});

