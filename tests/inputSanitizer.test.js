// ─────────────────────────────────────────────────────────────
// inputSanitizer.test.js
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';
import { sanitize, _internals } from '../src/inputSanitizer.js';

describe('inputSanitizer', () => {
  // ─── sanitize() ────────────────────────────────────────────

  describe('sanitize()', () => {
    test('returns cleaned lowercase text for valid input', () => {
      const result = sanitize('  Hello World!  ');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('hello world!');
    });

    test('strips HTML tags', () => {
      const result = sanitize('<b>Bold</b> and <script>alert("xss")</script> text');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('bold and alert("xss") text');
    });

    test('removes control characters', () => {
      const result = sanitize('Hello\x00\x01\x02World');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('helloworld');
    });

    test('removes zero-width characters', () => {
      const result = sanitize('Hello\u200BWorld');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('helloworld');
    });

    test('normalizes whitespace - collapses multiple spaces', () => {
      const result = sanitize('too    many     spaces');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('too many spaces');
    });

    test('normalizes whitespace - replaces tabs', () => {
      const result = sanitize('tab\there');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('tab here');
    });

    test('collapses repeated exclamation marks', () => {
      const result = sanitize('Help!!!');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('help!');
    });

    test('collapses repeated question marks', () => {
      const result = sanitize('Why???');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('why?');
    });

    test('preserves ellipsis (3 dots)', () => {
      const result = sanitize('I feel...');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('i feel...');
    });

    test('collapses 4+ dots to ellipsis', () => {
      const result = sanitize('I feel........');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('i feel...');
    });

    test('normalizes Unicode to NFC', () => {
      // é as two code points (e + combining accent) → NFC single codepoint
      const decomposed = 'caf\u0065\u0301';
      const result = sanitize(decomposed);
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('café');
    });

    test('rejects empty string', () => {
      const result = sanitize('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('rejects whitespace-only string', () => {
      const result = sanitize('   \t  \n  ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('rejects non-string input', () => {
      const result = sanitize(12345);
      expect(result.success).toBe(false);
      expect(result.error).toContain('string');
    });

    test('rejects null input', () => {
      const result = sanitize(null);
      expect(result.success).toBe(false);
    });

    test('rejects input exceeding max length', () => {
      const longInput = 'a'.repeat(_internals.MAX_INPUT_LENGTH + 1);
      const result = sanitize(longInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain('maximum length');
    });

    test('accepts input at max length boundary', () => {
      const input = 'a'.repeat(_internals.MAX_INPUT_LENGTH);
      const result = sanitize(input);
      expect(result.success).toBe(true);
    });

    test('handles mixed problematic content', () => {
      const result = sanitize('  <div>Hello!!!</div>\t\t  \x00World???  ');
      expect(result.success).toBe(true);
      expect(result.cleanedInput).toBe('hello! world?');
    });
  });
});
