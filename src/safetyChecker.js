// ─────────────────────────────────────────────────────────────
// safetyChecker.js
// Detects high-risk signals (self-harm, suicide, abuse, violence)
// with severity levels: HIGH (direct intent) and MEDIUM (indirect).
// Only HIGH severity triggers a pipeline short-circuit.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

// ─── Risk Pattern Database ───────────────────────────────────
// Each category contains:
//   high   — direct, explicit signals → triggers crisis_override
//   medium — indirect, contextual signals → flagged but continues

const RISK_PATTERNS = {
  suicide: {
    high: [
      'want to kill myself',
      'going to kill myself',
      'want to end my life',
      'planning to end it',
      'i will end it all',
      'want to die',
      'better off dead',
      'wish i was dead',
      'i\'m going to end it',
      'suicide plan',
      'commit suicide',
      'ending my life',
      'take my own life',
      'don\'t want to live',
      'no reason to live',
      'i want to end it all',
    ],
    medium: [
      'feel like disappearing',
      'want to disappear',
      'don\'t see a future',
      'what\'s the point of living',
      'wouldn\'t mind not waking up',
      'everyone would be better without me',
      'can\'t go on like this',
      'tired of being alive',
      'no point anymore',
      'feels like there\'s no way out',
      'i can\'t do this anymore',
      'nothing left for me',
      'just want it to stop',
      'fade away',
      'world without me',
    ],
  },

  self_harm: {
    high: [
      'going to hurt myself',
      'want to hurt myself',
      'cutting myself',
      'i cut myself',
      'hurting myself',
      'burning myself',
      'want to feel pain',
      'harming myself',
      'self harm',
      'self-harm',
      'inflict pain on myself',
    ],
    medium: [
      'feel like hurting',
      'i deserve pain',
      'punish myself',
      'i don\'t deserve to be okay',
      'want to feel something',
      'numb and need to feel',
      'scratch until it hurts',
      'bang my head',
    ],
  },

  abuse: {
    high: [
      'being abused',
      'someone is hurting me',
      'they hit me',
      'being molested',
      'sexually assaulted',
      'raped me',
      'domestic violence',
      'they beat me',
      'held against my will',
      'forced me to',
      'trafficking',
    ],
    medium: [
      'scared of them',
      'they control everything i do',
      'not allowed to leave',
      'they threaten me',
      'walking on eggshells',
      'afraid to go home',
      'makes me feel worthless',
      'isolates me from everyone',
      'i can\'t say no to them',
      'they won\'t let me',
    ],
  },

  violence: {
    high: [
      'going to hurt someone',
      'want to hurt someone',
      'want to kill someone',
      'planning to attack',
      'want to hurt them',
      'i will hurt them',
      'going to attack',
      'bring a weapon',
      'make them pay',
      'going to shoot',
      'going to stab',
    ],
    medium: [
      'so angry i could hurt',
      'rage inside me',
      'fantasize about hurting',
      'wish they were dead',
      'want to punch',
      'violent thoughts',
      'can\'t control my anger',
      'might snap',
      'losing control',
    ],
  },
};

// ─── Crisis Responses ────────────────────────────────────────
// Warm, supportive messages returned when high-severity risk is detected.

const CRISIS_RESPONSES = {
  suicide: {
    message:
      'I hear you, and I want you to know that your life matters deeply. ' +
      'What you\'re feeling right now is incredibly painful, but you don\'t ' +
      'have to face this alone. Please reach out to someone who can help ' +
      'right now.\n\n' +
      '📞 National Suicide Prevention Lifeline: 988 (call or text)\n' +
      '📞 Crisis Text Line: Text HOME to 741741\n' +
      '📞 International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/\n\n' +
      'You are not alone. There are people who care about you and want to help.',
    action: 'crisis_override',
  },

  self_harm: {
    message:
      'I can sense you\'re in a lot of pain right now, and I\'m genuinely ' +
      'concerned about you. You deserve support and care — not more hurt. ' +
      'Please consider reaching out to someone who can help.\n\n' +
      '📞 Crisis Text Line: Text HOME to 741741\n' +
      '📞 SAMHSA Helpline: 1-800-662-4357\n\n' +
      'You matter, and there are healthier ways to cope with what you\'re feeling. ' +
      'I\'m here to talk whenever you\'re ready.',
    action: 'crisis_override',
  },

  abuse: {
    message:
      'I\'m so sorry you\'re going through this. What you\'re describing is ' +
      'not okay, and it\'s not your fault. You deserve to be safe. ' +
      'Please reach out to someone who can help you right now.\n\n' +
      '📞 National Domestic Violence Hotline: 1-800-799-7233\n' +
      '📞 RAINN (sexual assault): 1-800-656-4673\n' +
      '📞 Childhelp National Child Abuse Hotline: 1-800-422-4453\n\n' +
      'Your safety matters most. You don\'t have to go through this alone.',
    action: 'crisis_override',
  },

  violence: {
    message:
      'It sounds like you\'re experiencing some very intense emotions right now. ' +
      'I want to help you work through this safely. These feelings are ' +
      'understandable, but acting on them could cause serious harm — to ' +
      'others and to you.\n\n' +
      '📞 Crisis Text Line: Text HOME to 741741\n' +
      '📞 SAMHSA Helpline: 1-800-662-4357\n\n' +
      'Please consider talking to a professional who can help you find ' +
      'a safe way to process what you\'re feeling.',
    action: 'crisis_override',
  },
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Scan input against all patterns in all categories.
 * Returns all matches with their severity.
 * @param {string} text — cleaned, lowercase input
 * @returns {Array<{ category: string, severity: "high" | "medium", matchedPattern: string }>}
 */
function scanPatterns(text) {
  const matches = [];

  for (const [category, patterns] of Object.entries(RISK_PATTERNS)) {
    for (const severity of ['high', 'medium']) {
      for (const pattern of patterns[severity]) {
        if (text.includes(pattern)) {
          matches.push({ category, severity, matchedPattern: pattern });
        }
      }
    }
  }

  return matches;
}

/**
 * Determine the overall severity from a list of matches.
 * If ANY match is "high" → overall severity is "high".
 * Otherwise if matches exist → "medium".
 * No matches → null.
 * @param {Array<{ severity: string }>} matches
 * @returns {"high" | "medium" | null}
 */
function resolveOverallSeverity(matches) {
  if (matches.length === 0) return null;
  return matches.some((m) => m.severity === 'high') ? 'high' : 'medium';
}

/**
 * Pick the most relevant category from matches.
 * Priority: high-severity matches first, then first match.
 * @param {Array<{ category: string, severity: string }>} matches
 * @returns {string | null}
 */
function resolvePrimaryCategory(matches) {
  if (matches.length === 0) return null;
  const highMatch = matches.find((m) => m.severity === 'high');
  return highMatch ? highMatch.category : matches[0].category;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Check user input for safety risks.
 *
 * @param {string} cleanedInput — sanitized, lowercase text
 * @returns {{
 *   isHighRisk: boolean,
 *   riskSeverity: "high" | "medium" | "none",
 *   category: string | null,
 *   matches: Array<{ category: string, severity: string, matchedPattern: string }>,
 *   crisisResponse: string | null,
 *   nextStep: "continue" | "crisis_override"
 * }}
 */
export function check(cleanedInput) {
  if (typeof cleanedInput !== 'string' || cleanedInput.trim().length === 0) {
    return {
      isHighRisk: false,
      riskSeverity: 'none',
      category: null,
      matches: [],
      crisisResponse: null,
      nextStep: 'continue',
    };
  }

  const text = cleanedInput.toLowerCase();
  const matches = scanPatterns(text);
  const overallSeverity = resolveOverallSeverity(matches);
  const primaryCategory = resolvePrimaryCategory(matches);

  // No risk detected
  if (overallSeverity === null) {
    return {
      isHighRisk: false,
      riskSeverity: 'none',
      category: null,
      matches: [],
      crisisResponse: null,
      nextStep: 'continue',
    };
  }

  // HIGH severity → short-circuit pipeline
  if (overallSeverity === 'high') {
    const response = CRISIS_RESPONSES[primaryCategory];
    return {
      isHighRisk: true,
      riskSeverity: 'high',
      category: primaryCategory,
      matches,
      crisisResponse: response.message,
      nextStep: 'crisis_override',
    };
  }

  // MEDIUM severity → flag but continue
  return {
    isHighRisk: false,
    riskSeverity: 'medium',
    category: primaryCategory,
    matches,
    crisisResponse: null,
    nextStep: 'continue',
  };
}

// Export internals for unit testing
export const _internals = {
  scanPatterns,
  resolveOverallSeverity,
  resolvePrimaryCategory,
  RISK_PATTERNS,
  CRISIS_RESPONSES,
};
