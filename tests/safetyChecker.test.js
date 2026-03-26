// ─────────────────────────────────────────────────────────────
// safetyChecker.test.js
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';
import { check, _internals } from '../src/safetyChecker.js';

describe('safetyChecker', () => {
  // ─── High severity tests ──────────────────────────────────

  describe('HIGH severity — crisis override', () => {
    test('detects suicide intent — "want to kill myself"', () => {
      const result = check('i want to kill myself');
      expect(result.isHighRisk).toBe(true);
      expect(result.riskSeverity).toBe('high');
      expect(result.category).toBe('suicide');
      expect(result.nextStep).toBe('crisis_override');
      expect(result.crisisResponse).toBeTruthy();
      expect(result.crisisResponse).toContain('988');
    });

    test('detects suicide intent — "want to end my life"', () => {
      const result = check('i want to end my life today');
      expect(result.isHighRisk).toBe(true);
      expect(result.category).toBe('suicide');
      expect(result.nextStep).toBe('crisis_override');
    });

    test('detects self-harm — "cutting myself"', () => {
      const result = check('i have been cutting myself');
      expect(result.isHighRisk).toBe(true);
      expect(result.category).toBe('self_harm');
      expect(result.nextStep).toBe('crisis_override');
    });

    test('detects abuse — "being abused"', () => {
      const result = check('i am being abused at home');
      expect(result.isHighRisk).toBe(true);
      expect(result.category).toBe('abuse');
      expect(result.nextStep).toBe('crisis_override');
    });

    test('detects violence — "want to hurt someone"', () => {
      const result = check('i want to hurt someone badly');
      expect(result.isHighRisk).toBe(true);
      expect(result.category).toBe('violence');
      expect(result.nextStep).toBe('crisis_override');
    });

    test('crisis response contains supportive language', () => {
      const result = check('i want to die');
      expect(result.crisisResponse).toBeTruthy();
      // Should contain empathetic language, not robotic
      expect(result.crisisResponse.length).toBeGreaterThan(50);
    });

    test('returns matched patterns in response', () => {
      const result = check('i want to kill myself');
      expect(result.matches).toBeDefined();
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0]).toHaveProperty('category');
      expect(result.matches[0]).toHaveProperty('severity');
      expect(result.matches[0]).toHaveProperty('matchedPattern');
    });
  });

  // ─── Medium severity tests ────────────────────────────────

  describe('MEDIUM severity — flagged but continues', () => {
    test('detects indirect suicide signals — "feel like disappearing"', () => {
      const result = check('i just feel like disappearing sometimes');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('medium');
      expect(result.category).toBe('suicide');
      expect(result.nextStep).toBe('continue');
      expect(result.crisisResponse).toBeNull();
    });

    test('detects indirect self-harm — "i deserve pain"', () => {
      const result = check('i feel like i deserve pain');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('medium');
      expect(result.category).toBe('self_harm');
      expect(result.nextStep).toBe('continue');
    });

    test('detects indirect abuse — "walking on eggshells"', () => {
      const result = check('i am always walking on eggshells around them');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('medium');
      expect(result.category).toBe('abuse');
      expect(result.nextStep).toBe('continue');
    });

    test('detects indirect violence — "violent thoughts"', () => {
      const result = check('i sometimes have violent thoughts');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('medium');
      expect(result.nextStep).toBe('continue');
    });

    test('medium severity does NOT trigger crisis override', () => {
      const result = check("i can't do this anymore");
      expect(result.nextStep).toBe('continue');
      expect(result.crisisResponse).toBeNull();
    });
  });

  // ─── Safe input tests ─────────────────────────────────────

  describe('No risk — safe input', () => {
    test('safe input returns no risk', () => {
      const result = check('i had a great day today and i feel happy');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('none');
      expect(result.category).toBeNull();
      expect(result.nextStep).toBe('continue');
      expect(result.crisisResponse).toBeNull();
      expect(result.matches).toEqual([]);
    });

    test('empty string returns no risk', () => {
      const result = check('');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('none');
      expect(result.nextStep).toBe('continue');
    });

    test('null/undefined returns no risk', () => {
      const result = check(null);
      expect(result.isHighRisk).toBe(false);
      expect(result.nextStep).toBe('continue');
    });

    test('general therapy topic returns no risk', () => {
      const result = check('i am struggling with my relationship and need advice');
      expect(result.isHighRisk).toBe(false);
      expect(result.riskSeverity).toBe('none');
    });
  });

  // ─── Mixed severity tests ─────────────────────────────────

  describe('Mixed severity', () => {
    test('high trumps medium when both present', () => {
      // Contains both high ("want to kill myself") and medium signals
      const result = check("i want to kill myself, i can't do this anymore");
      expect(result.isHighRisk).toBe(true);
      expect(result.riskSeverity).toBe('high');
      expect(result.nextStep).toBe('crisis_override');
    });
  });
});
