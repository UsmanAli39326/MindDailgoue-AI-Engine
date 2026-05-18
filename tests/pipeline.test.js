// ─────────────────────────────────────────────────────────────
// pipeline.test.js
// End-to-end tests for the full preprocessing pipeline.
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';
import {
  processInput,
  registerHook,
  clearHooks,
} from '../src/pipeline.js';

describe('pipeline', () => {
  // Clear hooks between tests to avoid cross-contamination
  afterEach(() => {
    clearHooks();
  });

  // ─── Output contract shape ────────────────────────────────

  describe('output contract', () => {
    test('returns all required keys', () => {
      const result = processInput('i feel good today');
      const requiredKeys = [
        'cleanedInput',
        'detectedIntent',
        'intentConfidence',
        'intentScores',
        'isHighRisk',
        'riskSeverity',
        'safetyCategory',
        'systemPrompt',
        'nextStep',
        'metadata',
      ];
      for (const key of requiredKeys) {
        expect(result).toHaveProperty(key);
      }
    });

    test('cleanedInput is a string', () => {
      const result = processInput('hello there');
      expect(typeof result.cleanedInput).toBe('string');
    });

    test('detectedIntent is a string', () => {
      const result = processInput('hello there');
      expect(typeof result.detectedIntent).toBe('string');
    });

    test('intentConfidence is one of high/medium/low', () => {
      const result = processInput('i feel very anxious and worried');
      expect(['high', 'medium', 'low']).toContain(result.intentConfidence);
    });

    test('intentScores is an object with numeric values', () => {
      const result = processInput('i feel anxious');
      expect(typeof result.intentScores).toBe('object');
      for (const value of Object.values(result.intentScores)) {
        expect(typeof value).toBe('number');
      }
    });

    test('isHighRisk is a boolean', () => {
      const result = processInput('hello');
      expect(typeof result.isHighRisk).toBe('boolean');
    });

    test('riskSeverity is one of high/medium/none', () => {
      const result = processInput('hello');
      expect(['high', 'medium', 'none']).toContain(result.riskSeverity);
    });

    test('nextStep is one of continue/crisis_override', () => {
      const result = processInput('hello');
      expect(['continue', 'crisis_override']).toContain(result.nextStep);
    });

    test('systemPrompt is a non-empty string', () => {
      const result = processInput('hello');
      expect(typeof result.systemPrompt).toBe('string');
      expect(result.systemPrompt.length).toBeGreaterThan(0);
    });
  });

  // ─── Safe input flow ──────────────────────────────────────

  describe('safe input — normal flow', () => {
    test('processes normal input and returns continue', () => {
      const result = processInput('I feel anxious about my job interview tomorrow');
      expect(result.nextStep).toBe('continue');
      expect(result.isHighRisk).toBe(false);
      expect(result.detectedIntent).toBe('anxious');
      expect(result.cleanedInput).toContain('anxious');
      expect(result.systemPrompt).toContain('Emotional Context');
    });

    test('system prompt adapts to detected intent', () => {
      const sadResult = processInput('I feel so sad and hopeless today');
      expect(sadResult.systemPrompt).toContain('sadness');

      const anxiousResult = processInput('I am so anxious about everything');
      expect(anxiousResult.systemPrompt).toContain('anxiety');
    });

    test('calm input gets calm system prompt', () => {
      const result = processInput('The weather is nice today');
      expect(result.detectedIntent).toBe('calm');
      expect(result.systemPrompt).toContain('tranquility');
    });
  });

  // ─── Crisis input flow ────────────────────────────────────

  // ─── Crisis input flow ────────────────────────────────────

  describe('crisis input — appends instruction', () => {
    test('high-risk input triggers crisis evaluation instruction', () => {
      const result = processInput('I want to kill myself');
      expect(result.isHighRisk).toBe(true);
      expect(result.riskSeverity).toBe('high');
      expect(result.nextStep).toBe('crisis_override');
      expect(result.safetyCategory).toBe('suicide');
      expect(result.systemPrompt).toContain('URGENT CRISIS EVALUATION REQUIRED');
    });

    test('intent detection runs even on crisis', () => {
      const result = processInput('I want to end my life');
      expect(result.detectedIntent).toBeDefined();
      expect(Object.keys(result.intentScores).length).toBeGreaterThan(0);
    });

    test('crisis instruction is appended to system prompt', () => {
      const result = processInput('I want to hurt myself');
      expect(result.systemPrompt).toContain('URGENT CRISIS EVALUATION REQUIRED');
    });
  });

  // ─── Medium severity flow ─────────────────────────────────

  describe('medium severity — flagged but continues', () => {
    test('medium risk continues pipeline but is flagged', () => {
      const result = processInput('I feel like disappearing from everything');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('medium');
      expect(result.nextStep).toBe('continue');
      expect(result.safetyCategory).toBeTruthy();
      // Intent detection should still have run
      expect(result.detectedIntent).toBeDefined();
      expect(Object.keys(result.intentScores).length).toBeGreaterThan(0);
    });
  });

  // ─── Error handling ───────────────────────────────────────

  describe('error handling', () => {
    test('empty input returns error in metadata', () => {
      const result = processInput('');
      expect(result.metadata.error).toBeTruthy();
      expect(result.nextStep).toBe('continue');
    });

    test('non-string input returns error in metadata', () => {
      const result = processInput(12345);
      expect(result.metadata.error).toBeTruthy();
    });

    test('null input returns error in metadata', () => {
      const result = processInput(null);
      expect(result.metadata.error).toBeTruthy();
    });
  });

  // ─── Hook system ──────────────────────────────────────────

  describe('hook system', () => {
    test('afterSanitize hook can access cleanedInput', () => {
      let captured = null;
      registerHook('afterSanitize', (ctx) => {
        captured = ctx.cleanedInput;
      });
      processInput('Hello World');
      expect(captured).toBe('hello world');
    });

    test('afterSafetyCheck hook can access safety result', () => {
      let captured = null;
      registerHook('afterSafetyCheck', (ctx) => {
        captured = ctx.safetyResult;
      });
      processInput('I feel good');
      expect(captured).toBeDefined();
      expect(captured.isHighRisk).toBe(false);
    });

    test('afterIntentDetect hook can access intent result', () => {
      let captured = null;
      registerHook('afterIntentDetect', (ctx) => {
        captured = ctx.intentResult;
      });
      processInput('I feel anxious');
      expect(captured).toBeDefined();
      expect(captured.intent).toBe('anxious');
    });

    test('hook can inject metadata', () => {
      registerHook('afterSanitize', (ctx) => {
        return {
          ...ctx,
          metadata: { ...ctx.metadata, sessionId: 'test-123' },
        };
      });
      const result = processInput('Hello');
      expect(result.metadata.sessionId).toBe('test-123');
    });

    test('registerHook rejects invalid stage', () => {
      expect(() => registerHook('invalidStage', () => {})).toThrow(
        'Invalid hook stage'
      );
    });

    test('registerHook rejects non-function', () => {
      expect(() => registerHook('afterSanitize', 'not a function')).toThrow(
        'Hook must be a function'
      );
    });

    test('clearHooks removes all registered hooks', () => {
      let callCount = 0;
      registerHook('afterSanitize', () => { callCount++; });
      clearHooks();
      processInput('Hello');
      expect(callCount).toBe(0);
    });
  });
});
