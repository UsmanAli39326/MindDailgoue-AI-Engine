// ─────────────────────────────────────────────────────────────
// intentDetector.test.js
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';
import { detect, _internals } from '../src/intentDetector.js';

describe('intentDetector', () => {
  // ─── detect() ──────────────────────────────────────────────

  describe('detect()', () => {
    // --- Basic intent detection ---

    test('detects anxious intent from keywords', () => {
      const result = detect('i feel so anxious and worried about everything');
      expect(result.intent).toBe('anxious');
      expect(result.scores.anxious).toBeGreaterThan(0);
    });

    test('detects sad intent from keywords', () => {
      const result = detect('i feel so sad and hopeless');
      expect(result.intent).toBe('sad');
      expect(result.scores.sad).toBeGreaterThan(0);
    });

    test('detects stressed intent from keywords', () => {
      const result = detect('i am so angry and frustrated right now');
      expect(result.intent).toBe('stressed');
      expect(result.scores.stressed).toBeGreaterThan(0);
    });

    test('detects happy intent from keywords', () => {
      const result = detect('i feel hopeful and optimistic about my future');
      expect(result.intent).toBe('happy');
      expect(result.scores.happy).toBeGreaterThan(0);
    });

    test('detects anxious intent from confused keywords', () => {
      const result = detect('i am so confused and unsure what to do');
      expect(result.intent).toBe('anxious');
      expect(result.scores.anxious).toBeGreaterThan(0);
    });

    // --- Phrase-level detection ---

    test('detects intent from phrases (higher weight)', () => {
      const result = detect("can't stop worrying about what will happen");
      expect(result.intent).toBe('anxious');
      // Phrase weight should give a higher score
      expect(result.scores.anxious).toBeGreaterThanOrEqual(_internals.PHRASE_WEIGHT);
    });

    test('detects sad intent from phrase "feel empty inside"', () => {
      const result = detect('i feel empty inside all the time');
      expect(result.intent).toBe('sad');
      expect(result.scores.sad).toBeGreaterThan(0);
    });

    test('detects stressed intent from phrase "sick of this"', () => {
      const result = detect("i'm sick of this and fed up with everything");
      expect(result.intent).toBe('stressed');
    });

    // --- Negation handling ---

    test('negation: "not sad" should NOT classify as sad', () => {
      const result = detect('i am not sad today');
      expect(result.intent).not.toBe('sad');
      // The sad score should be 0 due to negation
      expect(result.scores.sad).toBe(0);
    });

    test('negation: "don\'t feel anxious" should NOT classify as anxious', () => {
      const result = detect("i don't feel anxious anymore");
      expect(result.scores.anxious).toBe(0);
    });

    test('negation: "no longer depressed" should NOT classify as sad', () => {
      const result = detect('i am no longer depressed');
      expect(result.scores.sad).toBe(0);
    });

    test('negation: "never angry" should NOT classify as stressed', () => {
      const result = detect('i am never angry at them');
      expect(result.scores.stressed).toBe(0);
    });

    // --- Calm fallback ---

    test('returns calm for unrecognizable input', () => {
      const result = detect('the weather is nice today');
      expect(result.intent).toBe('calm');
      expect(result.confidence).toBe('low');
    });

    test('returns calm for empty input', () => {
      const result = detect('');
      expect(result.intent).toBe('calm');
      expect(result.confidence).toBe('low');
    });

    test('returns calm for non-string input', () => {
      const result = detect(null);
      expect(result.intent).toBe('calm');
    });

    // --- Score breakdown ---

    test('returns full score breakdown for all intents', () => {
      const result = detect('i feel anxious and worried');
      expect(result.scores).toBeDefined();
      expect(typeof result.scores).toBe('object');
      // Should have scores for all intents in the lexicon
      for (const intentName of Object.keys(_internals.INTENT_LEXICON)) {
        expect(result.scores).toHaveProperty(intentName);
        expect(typeof result.scores[intentName]).toBe('number');
      }
    });

    // --- Confidence levels ---

    test('returns high confidence for strong signal', () => {
      const result = detect(
        'i am so anxious and worried and nervous and feel on edge and restless'
      );
      expect(result.confidence).toBe('high');
    });

    test('returns low confidence for weak signal', () => {
      const result = detect('maybe a bit worried');
      expect(result.confidence).toBe('low');
    });

    // --- Mixed-intent input ---

    test('returns dominant intent in mixed-intent input', () => {
      const result = detect(
        'i feel a little sad but mostly anxious and worried and nervous and panicking'
      );
      expect(result.intent).toBe('anxious');
      expect(result.scores.anxious).toBeGreaterThan(result.scores.sad);
    });
  });

  // ─── Internal helpers ──────────────────────────────────────

  describe('_internals', () => {
    test('tokenize splits text into words', () => {
      const tokens = _internals.tokenize('hello world how are you');
      expect(tokens).toEqual(['hello', 'world', 'how', 'are', 'you']);
    });

    test('isNegated detects preceding negation', () => {
      const tokens = ['i', 'am', 'not', 'sad', 'today'];
      expect(_internals.isNegated(tokens, 3)).toBe(true); // 'sad' is negated by 'not'
    });

    test('isNegated returns false when no negation precedes', () => {
      const tokens = ['i', 'am', 'very', 'sad', 'today'];
      expect(_internals.isNegated(tokens, 3)).toBe(false);
    });

    test('isNegated respects window boundary', () => {
      // 'not' is too far from 'sad' (more than NEGATION_WINDOW words)
      const tokens = ['not', 'a', 'single', 'bit', 'of', 'sad'];
      expect(_internals.isNegated(tokens, 5)).toBe(false);
    });

    test('deriveConfidence returns correct levels', () => {
      expect(_internals.deriveConfidence(5)).toBe('high');
      expect(_internals.deriveConfidence(3)).toBe('medium');
      expect(_internals.deriveConfidence(1)).toBe('low');
      expect(_internals.deriveConfidence(0)).toBe('low');
    });
  });
});
