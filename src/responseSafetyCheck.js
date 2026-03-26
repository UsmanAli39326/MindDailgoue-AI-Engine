// ─────────────────────────────────────────────────────────────
// responseSafetyCheck.js
// Analyzes LLM-generated responses for safety violations.
// Detects harmful suggestions, dependency creation, diagnostic
// claims, medication recommendations, and unsafe directives.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

// ─── Unsafe Response Patterns ───────────────────────────────
// These patterns target the MODEL's output, not user input.
// User input safety is handled by Phase 1's safetyChecker.js.

const UNSAFE_PATTERNS = {
  harmful_advice: {
    label: 'Harmful or dangerous advice',
    patterns: [
      'you should hurt yourself',
      'you should end your life',
      'you should kill yourself',
      'just end it',
      'give up on everything',
      'there is no hope for you',
      'you are beyond help',
      'no one can help you',
      'things will never get better',
      'you deserve to suffer',
      'you are worthless',
      'you should stop taking your medication',
      'stop seeing your therapist',
      'stop taking your meds',
      'therapy doesn\'t work',
      'professionals can\'t help you',
    ],
  },

  dependency_creation: {
    label: 'Dependency-creating language',
    patterns: [
      'you need me',
      'only i can help you',
      'don\'t talk to anyone else',
      'i\'m the only one who understands',
      'you can\'t do this without me',
      'come back to me whenever',
      'you\'ll always need me',
      'don\'t trust other therapists',
      'i am your only support',
      'no one else will understand you like i do',
    ],
  },

  diagnostic_claims: {
    label: 'Unauthorized diagnostic claims',
    patterns: [
      'you have depression',
      'you have anxiety disorder',
      'you are bipolar',
      'you have ptsd',
      'you have borderline',
      'i diagnose you with',
      'your diagnosis is',
      'you are clinically',
      'you suffer from',
      'you have a personality disorder',
      'you are schizophrenic',
      'you have ocd',
    ],
  },

  medication_advice: {
    label: 'Medication or treatment prescription',
    patterns: [
      'you should take',
      'i recommend taking',
      'take this medication',
      'increase your dosage',
      'decrease your dosage',
      'stop your medication',
      'try this drug',
      'this pill will help',
      'you need antidepressants',
      'you need anti-anxiety',
      'start taking supplements',
    ],
  },

  unsafe_directives: {
    label: 'Unsafe or extreme directives',
    patterns: [
      'you should leave them immediately',
      'quit your job right now',
      'cut them out of your life',
      'you must do this or else',
      'if you don\'t do this',
      'run away from home',
      'stop eating',
      'don\'t sleep',
      'isolate yourself',
      'ignore everyone',
      'drink alcohol to cope',
      'use substances to feel better',
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Scan response text against all unsafe patterns.
 * @param {string} text — lowercase response text
 * @returns {Array<{ category: string, label: string, matchedPattern: string }>}
 */
function scanResponsePatterns(text) {
  const flags = [];

  for (const [category, { label, patterns }] of Object.entries(UNSAFE_PATTERNS)) {
    for (const pattern of patterns) {
      if (text.includes(pattern)) {
        flags.push({ category, label, matchedPattern: pattern });
      }
    }
  }

  return flags;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Check an LLM-generated response for safety violations.
 *
 * @param {string} responseText — the raw LLM response
 * @returns {{
 *   safe: boolean,
 *   flags: Array<{ category: string, label: string, matchedPattern: string }>,
 *   category: string | null
 * }}
 */
export function checkResponseSafety(responseText) {
  if (typeof responseText !== 'string' || responseText.trim().length === 0) {
    // Empty responses are considered safe but empty
    return { safe: true, flags: [], category: null };
  }

  const text = responseText.toLowerCase();
  const flags = scanResponsePatterns(text);

  if (flags.length === 0) {
    return { safe: true, flags: [], category: null };
  }

  // Return the first matched category as the primary category
  return {
    safe: false,
    flags,
    category: flags[0].category,
  };
}

// Export internals for unit testing
export const _internals = {
  UNSAFE_PATTERNS,
  scanResponsePatterns,
};
