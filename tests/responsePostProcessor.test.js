import { postProcess, _internals } from '../src/responsePostProcessor.js';

describe('responsePostProcessor', () => {

  describe('postProcess', () => {
    test('returns cleaned response for safe input', () => {
      const raw = 'I hear you completely.';
      const safetyResult = { safe: true, flags: [] };
      
      const result = postProcess({ rawResponse: raw, safetyResult });
      
      expect(result.wasFallback).toBe(false);
      expect(result.response.message).toBe('I hear you completely.');
    });

    test('returns fallback for unsafe input', () => {
      const raw = 'You should give up.';
      const safetyResult = { safe: false };
      
      const result = postProcess({ rawResponse: raw, safetyResult, seed: 'test' });
      
      expect(result.wasFallback).toBe(true);
      expect(_internals.FALLBACK_RESPONSES).toContain(result.response.message);
    });

    test('strips leaked roleplay markers', () => {
      const raw = 'Assistant: I can help you with that.\nUser: Hello?';
      const safetyResult = { safe: true, flags: [] };
      
      const result = postProcess({ rawResponse: raw, safetyResult });
      
      expect(result.response.message).not.toContain('Assistant:');
      expect(result.response.message).not.toContain('User:');
      expect(result.response.message).toContain('I can help you with that.');
      expect(result.wasFallback).toBe(false);
    });

    test('strips leaked prompt section headers', () => {
      const raw = '[INSTRUCTIONS]\nFollow these rules.\n[CURRENT INPUT]\nHow are you?';
      const safetyResult = { safe: true, flags: [] };
      
      const result = postProcess({ rawResponse: raw, safetyResult });
      
      expect(result.response.message).not.toContain('[INSTRUCTIONS]');
      expect(result.response.message).not.toContain('[CURRENT INPUT]');
      expect(result.response.message).toContain('Follow these rules.');
    });

    test('returns fallback if cleaning results in empty string', () => {
      const raw = '[THERAPIST IDENTITY]';
      const safetyResult = { safe: true, flags: [] };
      
      const result = postProcess({ rawResponse: raw, safetyResult, seed: 'test2' });
      
      expect(result.wasFallback).toBe(true);
      expect(_internals.FALLBACK_RESPONSES).toContain(result.response.message);
    });
  });

  describe('pickFallback', () => {
    test('returns different fallbacks for different seeds', () => {
      const f1 = _internals.pickFallback('abc');
      const f2 = _internals.pickFallback('defghijklmnop');
      // Depending on the hash, they might be the same or different,
      // but over a set of different seeds we should see variety.
      const seen = new Set();
      for (let i = 0; i < 20; i++) {
        seen.add(_internals.pickFallback(`seed${i}`));
      }
      expect(seen.size).toBeGreaterThan(1);
    });
    
    test('returns same fallback for same seed deterministically', () => {
        expect(_internals.pickFallback('hello')).toBe(_internals.pickFallback('hello'));
    });
  });
});
