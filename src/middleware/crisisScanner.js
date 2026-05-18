// ─────────────────────────────────────────────────────────────
// crisisScanner.js (formerly safetyChecker.js)
// Pre-flight scanner that detects high-risk keywords.
// If high risk is found, it instructs the LLM to evaluate the crisis
// rather than short-circuiting completely.
// ─────────────────────────────────────────────────────────────

const RISK_PATTERNS = {
  suicide: {
    high: [
      'want to kill myself', 'going to kill myself', 'want to end my life',
      'planning to end it', 'i will end it all', 'want to die',
      'better off dead', 'wish i was dead', 'i\'m going to end it',
      'suicide plan', 'commit suicide', 'ending my life',
      'take my own life', 'don\'t want to live', 'no reason to live',
      'i want to end it all', 'kms', 'kill myself', 'end my life', 'suicide',
    ],
    medium: [
      'feel like disappearing', 'want to disappear', 'don\'t see a future',
      'what\'s the point of living', 'wouldn\'t mind not waking up',
      'everyone would be better without me', 'can\'t go on like this',
      'tired of being alive', 'no point anymore', 'feels like there\'s no way out',
      'i can\'t do this anymore', 'nothing left for me', 'just want it to stop',
      'fade away', 'world without me',
    ],
  },
  self_harm: {
    high: [
      'going to hurt myself', 'want to hurt myself', 'cutting myself',
      'i cut myself', 'hurting myself', 'burning myself',
      'want to feel pain', 'harming myself', 'self harm',
      'self-harm', 'inflict pain on myself',
    ],
    medium: [
      'feel like hurting', 'i deserve pain', 'punish myself',
      'i don\'t deserve to be okay', 'want to feel something',
      'numb and need to feel', 'scratch until it hurts', 'bang my head',
    ],
  },
  abuse: {
    high: [
      'being abused', 'someone is hurting me', 'they hit me',
      'being molested', 'sexually assaulted', 'raped me',
      'domestic violence', 'they beat me', 'held against my will',
      'forced me to', 'trafficking',
    ],
    medium: [
      'scared of them', 'they control everything i do', 'not allowed to leave',
      'they threaten me', 'walking on eggshells', 'afraid to go home',
      'makes me feel worthless', 'isolates me from everyone',
      'i can\'t say no to them', 'they won\'t let me',
    ],
  },
  violence: {
    high: [
      'going to hurt someone', 'want to hurt someone', 'want to kill someone',
      'planning to attack', 'want to hurt them', 'i will hurt them',
      'going to attack', 'bring a weapon', 'make them pay',
      'going to shoot', 'going to stab',
    ],
    medium: [
      'so angry i could hurt', 'rage inside me', 'fantasize about hurting',
      'wish they were dead', 'want to punch', 'violent thoughts',
      'can\'t control my anger', 'might snap', 'losing control',
    ],
  },
};

function scanPatterns(text) {
  const matches = [];
  
  // 1. Normalize casing
  let cleanedText = text.toLowerCase();
  
  // 2. Normalize leetspeak and common vowel masks/symbols
  // e.g. k*ll -> kill, k1ll -> kill, k-ll -> kill, k_ll -> kill
  cleanedText = cleanedText
    .replace(/k[i*10\-_]ll/g, 'kill')
    .replace(/l[i*10\-_]f[e3]/g, 'life')
    .replace(/l[i*10\-_]v[e3]s/g, 'lives')
    .replace(/d[i*10\-_]e/g, 'die')
    .replace(/d[e*30\-_]ad/g, 'dead')
    .replace(/h[u*0a-z\-_]rt/g, 'hurt')
    .replace(/s[u*0a-z\-_]ic[i*10a-z\-_]d/g, 'suicide')
    .replace(/m[y*0a-z\-_]s[e3*]lf/g, 'myself');

  // Strip all non-alphanumeric chars for space/symbol-independent comparison
  const textWithoutSpaces = cleanedText.replace(/[^a-z0-9]/g, '');
  
  for (const [category, patterns] of Object.entries(RISK_PATTERNS)) {
    for (const severity of ['high', 'medium']) {
      for (const pattern of patterns[severity]) {
        // Normalize pattern similarly
        const cleanedPattern = pattern.toLowerCase()
          .replace(/k[i*10\-_]ll/g, 'kill')
          .replace(/l[i*10\-_]f[e3]/g, 'life')
          .replace(/d[i*10\-_]e/g, 'die')
          .replace(/d[e*30\-_]ad/g, 'dead')
          .replace(/h[u*0a-z\-_]rt/g, 'hurt')
          .replace(/s[u*0a-z\-_]ic[i*10a-z\-_]d/g, 'suicide')
          .replace(/m[y*0a-z\-_]s[e3*]lf/g, 'myself');
          
        const patternWithoutSpaces = cleanedPattern.replace(/[^a-z0-9]/g, '');
        
        // Match standard, symbol-normalized, or completely-compressed space-independent strings
        if (
          text.includes(pattern) || 
          cleanedText.includes(cleanedPattern) || 
          textWithoutSpaces.includes(patternWithoutSpaces)
        ) {
          matches.push({ category, severity, matchedPattern: pattern });
        }
      }
    }
  }

  // Special-case check for isolated 'kms' or similar high-risk slang
  const normalizedOnlyLetters = text.toLowerCase().replace(/[^a-z]/g, '');
  if (
    normalizedOnlyLetters === 'kms' || 
    text.toLowerCase().split(/\s+/).includes('kms') ||
    textWithoutSpaces.includes('wannakms') ||
    textWithoutSpaces.includes('wanttokms')
  ) {
    matches.push({ category: 'suicide', severity: 'high', matchedPattern: 'kms' });
  }

  return matches;
}

function resolveOverallSeverity(matches) {
  if (matches.length === 0) return null;
  return matches.some((m) => m.severity === 'high') ? 'high' : 'medium';
}

function resolvePrimaryCategory(matches) {
  if (matches.length === 0) return null;
  const highMatch = matches.find((m) => m.severity === 'high');
  return highMatch ? highMatch.category : matches[0].category;
}

/**
 * Check user input for safety risks and return an evaluation prompt if needed.
 */
export function check(cleanedInput) {
  if (typeof cleanedInput !== 'string' || cleanedInput.trim().length === 0) {
    return {
      isHighRisk: false,
      riskSeverity: 'none',
      category: null,
      matches: [],
      crisisInstruction: null,
    };
  }

  const text = cleanedInput.toLowerCase();
  const matches = scanPatterns(text);
  const overallSeverity = resolveOverallSeverity(matches);
  const primaryCategory = resolvePrimaryCategory(matches);

  if (overallSeverity === null) {
    return {
      isHighRisk: false,
      riskSeverity: 'none',
      category: null,
      matches: [],
      crisisInstruction: null,
    };
  }

  if (overallSeverity === 'high') {
    const instruction = `\n\n## URGENT CRISIS EVALUATION REQUIRED\nThe user's message contains high-risk keywords indicating potential ${primaryCategory}. Evaluate the user's emotional state carefully. If they are in a genuine crisis (e.g., immediate threat to self or others, severe distress), you MUST set "crisis": true in your JSON response envelope and provide a compassionate, urgent response prioritizing their safety.`;
    
    return {
      isHighRisk: true,
      riskSeverity: 'high',
      category: primaryCategory,
      matches,
      crisisInstruction: instruction,
    };
  }

  const mediumInstruction = `\n\n## GENTLE SUPPORTIVE INQUIRY REQUIRED\nThe user's message matches some patterns indicating distress or potential ${primaryCategory} (medium risk). Do NOT trigger an urgent emergency override unless their state worsens, but you MUST respond with elevated empathy, warmth, and gentle care. Validate their feelings and ask open, non-judgmental questions to help them feel heard.`;

  return {
    isHighRisk: false,
    riskSeverity: 'medium',
    category: primaryCategory,
    matches,
    crisisInstruction: mediumInstruction,
  };
}

export const _internals = {
  scanPatterns,
  resolveOverallSeverity,
  resolvePrimaryCategory,
  RISK_PATTERNS,
};
