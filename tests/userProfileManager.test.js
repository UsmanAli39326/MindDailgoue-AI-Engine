import { getProfile, updateProfile, clearAll, _internals } from '../src/userProfileManager.js';

describe('userProfileManager', () => {
  beforeEach(() => {
    clearAll();
  });

  test('creates empty profile on get', () => {
    const profile = getProfile('session1');
    expect(profile.dominantEmotion).toBe('neutral');
    expect(profile.recurringThemes).toEqual([]);
    expect(profile.tonePreference).toBeNull();
  });

  test('calculates dominant emotion incrementally (weighted average)', () => {
    // Session starts neutral
    let profile = getProfile('session2');
    
    // Add sad
    updateProfile('session2', { intent: 'sad' });
    profile = getProfile('session2');
    expect(profile.dominantEmotion).toBe('sad');

    // Add sad again (sad leads 2.0 to 0)
    updateProfile('session2', { intent: 'sad' });
    
    // Add anxious (sad leads 2.0 to 1.0)
    updateProfile('session2', { intent: 'anxious' });
    profile = getProfile('session2');
    expect(profile.dominantEmotion).toBe('sad'); // Still sad

    // With DECAY_FACTOR=0.9, previous weights decay. Add anxious multiple times
    for (let i = 0; i < 5; i++) {
        updateProfile('session2', { intent: 'anxious' });
    }

    profile = getProfile('session2');
    expect(profile.dominantEmotion).toBe('anxious'); 
  });

  test('adds themes to set without duplicating', () => {
    updateProfile('themeSession', { theme: 'work' });
    updateProfile('themeSession', { theme: 'work' });
    updateProfile('themeSession', { theme: 'family' });

    const profile = getProfile('themeSession');
    expect(profile.recurringThemes).toEqual(['work', 'family']);
  });

  test('updates tone preference', () => {
    updateProfile('toneSession', { tonePreference: 'gentle' });
    expect(getProfile('toneSession').tonePreference).toBe('gentle');
    
    updateProfile('toneSession', { tonePreference: 'direct' });
    expect(getProfile('toneSession').tonePreference).toBe('direct');
  });
});
