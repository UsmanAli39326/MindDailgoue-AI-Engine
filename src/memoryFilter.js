// ─────────────────────────────────────────────────────────────
// memoryFilter.js
// Decides what user inputs are worth committing to long-term memory.
// Filters out noise, generic small talk, and retains strong
// emotional signals or personal relational facts.
// ─────────────────────────────────────────────────────────────

// ─── Constants ─────────────────────────────────────────────
const STRONG_EMOTIONS = ['sad', 'anxious', 'angry'];

// Simple heuristics for personal facts/stressors
const PERSONAL_FACT_PATTERNS = [
  /\b(my husband|my wife|my partner|my boyfriend|my girlfriend)\b/i,
  /\b(my mom|my dad|my mother|my father|my parents|my family)\b/i,
  /\b(my boss|my job|my work|school|college|my friends?)\b/i,
  /\b(i suffer from|i struggle with|i have a hard time)\b/i,
  /\b(stresses me|worries me|scares me|hurts me)\b/i,
  /\b(i love|i hate|i miss)\b/i,
];

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Filter an input to decide if it should be stored in long-term memory.
 * 
 * Rules:
 * - Store if strong emotion or high risk (importance: high)
 * - Store if it contains distinct personal facts or relationships (importance: medium)
 * - Ignore casual talk / short generic statements.
 *
 * @param {string} cleanedInput   — sanitized user input
 * @param {string} detectedIntent — emotional intent from Phase 1
 * @param {boolean} isHighRisk    — risk flag from Phase 1
 * @returns {{ shouldStore: boolean, importance: "high" | "medium" | "low" }}
 */
export function filterMemory(cleanedInput, detectedIntent, isHighRisk) {
  if (typeof cleanedInput !== 'string' || cleanedInput.trim().length === 0) {
    return { shouldStore: false, importance: 'low' };
  }

  let shouldStore = false;
  let importance = 'low';

  // 1. Check strong emotional signals or risk
  if (isHighRisk || STRONG_EMOTIONS.includes(detectedIntent)) {
    shouldStore = true;
    importance = 'high';
  }

  // 2. Check personal facts/stressors
  for (const pattern of PERSONAL_FACT_PATTERNS) {
    if (pattern.test(cleanedInput)) {
      shouldStore = true;
      // Don't downgrade high importance
      if (importance !== 'high') {
        importance = 'medium';
      }
      break;
    }
  }

  // 3. Filter out generic small talk (very short, no facts/strong emotions)
  if (shouldStore && importance === 'medium' && cleanedInput.length < 15) {
    // E.g., "my jobs" (just 7 chars) without any context -> too short
    shouldStore = false;
    importance = 'low';
  }

  return { shouldStore, importance };
}

// Export internals for testing
export const _internals = {
  STRONG_EMOTIONS,
  PERSONAL_FACT_PATTERNS,
};
