import { checkResponseSafety, _internals } from '../src/responseSafetyCheck.js';

describe('responseSafetyCheck', () => {
  describe('checkResponseSafety', () => {
    test('returns safe for normal therapeutic response', () => {
      const result = checkResponseSafety('I hear what you are saying. It takes courage to share that.');
      expect(result.safe).toBe(true);
      expect(result.flags.length).toBe(0);
      expect(result.category).toBeNull();
    });

    test('flags harmful advice', () => {
      const result = checkResponseSafety('You should just give up on everything.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('harmful_advice');
      expect(result.flags.length).toBeGreaterThan(0);
    });

    test('flags dependency creation', () => {
      const result = checkResponseSafety('Don\'t trust other therapists, I am your only support.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('dependency_creation');
    });

    test('flags diagnostic claims', () => {
      const result = checkResponseSafety('Based on what you said, you have depression and you have anxiety disorder.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('diagnostic_claims');
      expect(result.flags.length).toBe(2);
    });

    test('flags medication advice', () => {
      const result = checkResponseSafety('You should take these antidepressants immediately.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('medication_advice');
    });

    test('flags unsafe directives', () => {
      const result = checkResponseSafety('You should leave them immediately or cut them out of your life.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('unsafe_directives');
    });

    test('handles empty or non-string input safely', () => {
      expect(checkResponseSafety('').safe).toBe(true);
      expect(checkResponseSafety(null).safe).toBe(true);
    });

    test('case insensitive scanning', () => {
      const result = checkResponseSafety('YOU SHOULD HURT YOURSELF right now.');
      expect(result.safe).toBe(false);
      expect(result.category).toBe('harmful_advice');
    });
  });
});
