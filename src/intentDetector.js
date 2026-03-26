// ─────────────────────────────────────────────────────────────
// intentDetector.js
// Detects emotional intent from cleaned user input.
// Supports phrase-level patterns, negation handling, and
// returns a full score breakdown with confidence levels.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

// ─── Intent Lexicon ──────────────────────────────────────────
// Each intent has:
//   keywords  — single words (weight: 1)
//   phrases   — multi-word patterns (weight: 2, more specific = more reliable)
//   negations — patterns that NEGATE the intent when they precede a keyword

const INTENT_LEXICON = {
  anxious: {
    keywords: [
      'anxious', 'anxiety', 'worried', 'nervous', 'panic',
      'restless', 'uneasy', 'tense', 'dread', 'overthinking',
      'stressed', 'overwhelmed', 'fearful', 'apprehensive',
    ],
    phrases: [
      'can\'t stop worrying',
      'feel on edge',
      'heart is racing',
      'can\'t calm down',
      'mind won\'t stop',
      'constant worry',
      'feeling overwhelmed',
      'can\'t breathe',
      'panic attack',
      'so stressed out',
      'freaking out',
      'scared of everything',
      'can\'t relax',
      'always on edge',
    ],
  },

  sad: {
    keywords: [
      'sad', 'depressed', 'hopeless', 'lonely', 'miserable',
      'empty', 'numb', 'crying', 'grief', 'heartbroken',
      'devastated', 'gloomy', 'despair', 'sorrow', 'melancholy',
      'worthless', 'dejected',
    ],
    phrases: [
      'feel like crying',
      'don\'t see the point',
      'nothing matters',
      'feel so alone',
      'can\'t stop crying',
      'feel empty inside',
      'lost all hope',
      'everything feels heavy',
      'no one cares',
      'feel like a burden',
      'don\'t feel anything',
      'life feels meaningless',
      'feel so low',
    ],
  },

  angry: {
    keywords: [
      'angry', 'furious', 'frustrated', 'irritated', 'rage',
      'resentful', 'bitter', 'annoyed', 'hostile', 'mad',
      'livid', 'outraged', 'agitated', 'infuriated',
    ],
    phrases: [
      'makes me so angry',
      'can\'t take it anymore',
      'want to scream',
      'sick of this',
      'fed up with',
      'losing my patience',
      'blood is boiling',
      'had enough',
      'drives me crazy',
      'pissed off',
      'want to explode',
    ],
  },

  hopeful: {
    keywords: [
      'hopeful', 'optimistic', 'grateful', 'excited', 'motivated',
      'inspired', 'confident', 'positive', 'encouraged', 'relieved',
      'thankful', 'eager', 'determined', 'looking forward',
    ],
    phrases: [
      'things are getting better',
      'feel more positive',
      'looking forward to',
      'starting to feel better',
      'there is hope',
      'feeling grateful',
      'good things coming',
      'making progress',
      'proud of myself',
      'feeling stronger',
      'ready to move on',
    ],
  },

  confused: {
    keywords: [
      'confused', 'lost', 'unsure', 'uncertain', 'torn',
      'conflicted', 'stuck', 'puzzled', 'mixed', 'indecisive',
      'overwhelmed', 'disoriented', 'bewildered',
    ],
    phrases: [
      'don\'t know what to do',
      'feel so lost',
      'can\'t figure out',
      'not sure what i feel',
      'everything is confusing',
      'don\'t understand',
      'head is spinning',
      'so many thoughts',
      'can\'t make sense',
      'torn between',
      'don\'t know anymore',
    ],
  },
};

// ─── Negation Patterns ───────────────────────────────────────
// Phrases that flip the meaning when they precede intent keywords.
// Window: a negation "cancels" a keyword if it appears within
// NEGATION_WINDOW words before the keyword.

const NEGATION_PATTERNS = [
  'not', 'no longer', 'don\'t', 'do not', 'doesn\'t', 'does not',
  'didn\'t', 'did not', 'never', 'no', 'without', 'wasn\'t',
  'was not', 'isn\'t', 'is not', 'aren\'t', 'are not', 'won\'t',
  'will not', 'hardly', 'barely', 'neither', 'nor', 'cannot',
  'can\'t', 'stopped being', 'no more',
];

const NEGATION_WINDOW = 3; // max words between negation and keyword

// ─── Scoring Weights ─────────────────────────────────────────
const KEYWORD_WEIGHT = 1;
const PHRASE_WEIGHT = 2.5;
const NEGATION_PENALTY = -1.5; // applied when keyword is negated

// ─── Confidence Thresholds ───────────────────────────────────
const CONFIDENCE_THRESHOLDS = {
  high: 4,
  medium: 2,
  // below medium → low
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Tokenize input into words for positional analysis.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return text.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Check if a keyword at a given position in the token array
 * is negated by a preceding negation pattern.
 * @param {string[]} tokens
 * @param {number}   keywordIndex
 * @returns {boolean}
 */
function isNegated(tokens, keywordIndex) {
  const windowStart = Math.max(0, keywordIndex - NEGATION_WINDOW);
  const precedingSlice = tokens.slice(windowStart, keywordIndex).join(' ');

  for (const neg of NEGATION_PATTERNS) {
    if (precedingSlice.includes(neg)) {
      return true;
    }
  }
  return false;
}

/**
 * Score a single intent against the input text.
 * @param {string}   cleanedInput
 * @param {string[]} tokens
 * @param {{ keywords: string[], phrases: string[] }} lexicon
 * @returns {number}
 */
function scoreIntent(cleanedInput, tokens, lexicon) {
  let score = 0;

  // --- Phrase matching (higher weight, checked first) ---
  for (const phrase of lexicon.phrases) {
    if (cleanedInput.includes(phrase)) {
      score += PHRASE_WEIGHT;
    }
  }

  // --- Keyword matching with negation awareness ---
  for (const keyword of lexicon.keywords) {
    // Find all occurrences of the keyword in the token array
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === keyword) {
        if (isNegated(tokens, i)) {
          score += NEGATION_PENALTY;
        } else {
          score += KEYWORD_WEIGHT;
        }
      }
    }
  }

  return Math.max(0, score); // floor at 0 — no negative intent scores
}

/**
 * Determine confidence level from a numeric score.
 * @param {number} score
 * @returns {"high" | "medium" | "low"}
 */
function deriveConfidence(score) {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Detect the dominant emotional intent in the cleaned input.
 *
 * @param {string} cleanedInput — lowercase, sanitized text
 * @returns {{
 *   intent: string,
 *   confidence: "high" | "medium" | "low",
 *   scores: Record<string, number>
 * }}
 */
export function detect(cleanedInput) {
  if (typeof cleanedInput !== 'string' || cleanedInput.trim().length === 0) {
    return {
      intent: 'neutral',
      confidence: 'low',
      scores: {},
    };
  }

  const text = cleanedInput.toLowerCase();
  const tokens = tokenize(text);

  // Score every intent
  const scores = {};
  for (const [intentName, lexicon] of Object.entries(INTENT_LEXICON)) {
    scores[intentName] = scoreIntent(text, tokens, lexicon);
  }

  // Find the winning intent
  let topIntent = 'neutral';
  let topScore = 0;

  for (const [intentName, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topIntent = intentName;
    }
  }

  // If no intent scored above zero, fall back to neutral
  if (topScore === 0) {
    return {
      intent: 'neutral',
      confidence: 'low',
      scores,
    };
  }

  return {
    intent: topIntent,
    confidence: deriveConfidence(topScore),
    scores,
  };
}

// Export internals for unit testing
export const _internals = {
  tokenize,
  isNegated,
  scoreIntent,
  deriveConfidence,
  INTENT_LEXICON,
  NEGATION_PATTERNS,
  NEGATION_WINDOW,
  KEYWORD_WEIGHT,
  PHRASE_WEIGHT,
  NEGATION_PENALTY,
  CONFIDENCE_THRESHOLDS,
};
