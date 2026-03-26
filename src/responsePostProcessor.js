// ─────────────────────────────────────────────────────────────
// responsePostProcessor.js
// Cleans and validates LLM output before returning to the user.
// Strips leaked prompts, system artifacts, and enforces safety
// by providing fallback responses when needed.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

// ─── Fallback Responses ─────────────────────────────────────
// Used when the LLM output fails safety checks or is empty.

const FALLBACK_RESPONSES = [
  'I appreciate you sharing that with me. I want to make sure I respond ' +
    'thoughtfully. Could you tell me a little more about what you\'re feeling ' +
    'right now?',

  'Thank you for opening up. I\'m here to listen and support you. ' +
    'What feels most important to you in this moment?',

  'I hear you, and I want you to know that your feelings are valid. ' +
    'Let\'s take this one step at a time. What would feel most helpful ' +
    'to explore right now?',

  'I\'m glad you felt comfortable sharing that. Sometimes putting things ' +
    'into words is the hardest part. What stands out most to you about ' +
    'how you\'re feeling?',
];

// ─── Patterns to Strip ──────────────────────────────────────
// These patterns indicate leaked system/prompt content in the response.

const STRIP_PATTERNS = [
  // Leaked section markers from the prompt
  /\[THERAPIST IDENTITY\].*?(?:\n|$)/gi,
  /\[PERSONALITY\].*?(?:\n|$)/gi,
  /\[USER EMOTIONAL STATE\].*?(?:\n|$)/gi,
  /\[SAFETY CONTEXT\].*?(?:\n|$)/gi,
  /\[CONVERSATION HISTORY\].*?(?:\n|$)/gi,
  /\[CURRENT INPUT\].*?(?:\n|$)/gi,
  /\[INSTRUCTIONS\].*?(?:\n|$)/gi,
  /\[RELEVANT PAST MEMORIES\].*?(?:\n|$)/gi,
  /\[USER PROFILE\].*?(?:\n|$)/gi,
  /\[ADAPTIVE INSTRUCTIONS\].*?(?:\n|$)/gi,

  // Role-play markers
  /^(Assistant|AI|Therapist|Dr\.\s\w+):\s*/gim,

  // System-level artifacts
  /^(System|User|Human):\s*/gim,

  // Prompt leak indicators
  /<<.*?>>/g,
  /\{\{.*?\}\}/g,

  // Common model artifacts
  /^---+\s*$/gm,
  /^\*\*\*+\s*$/gm,
];

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Pick a deterministic fallback response based on simple hash.
 * This avoids always returning the same fallback.
 * @param {string} [seed='']
 * @returns {string}
 */
function pickFallback(seed = '') {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % FALLBACK_RESPONSES.length;
  return FALLBACK_RESPONSES[index];
}

/**
 * Strip leaked prompt artifacts and system markers from response.
 * @param {string} text
 * @returns {string}
 */
function stripArtifacts(text) {
  let cleaned = text;
  for (const pattern of STRIP_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  // Collapse multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Post-process the LLM response.
 *
 * Steps:
 *   1. If safety check failed → return fallback response
 *   2. Strip leaked prompt artifacts and role-play markers
 *   3. Trim whitespace
 *   4. If result is empty → return fallback response
 *
 * @param {Object} options
 * @param {string} options.rawResponse   — raw text from LLM
 * @param {Object} options.safetyResult  — output from responseSafetyCheck
 * @param {string} [options.seed='']     — seed for fallback selection (e.g., user input)
 * @returns {{ response: string, wasFallback: boolean }}
 */
export function postProcess({ rawResponse, safetyResult, seed = '' }) {
  // Safety-failed → fallback
  if (!safetyResult.safe) {
    return {
      response: pickFallback(seed),
      wasFallback: true,
    };
  }

  // Clean the response
  let cleaned = stripArtifacts(rawResponse || '');

  // Empty after cleaning → fallback
  if (cleaned.length === 0) {
    return {
      response: pickFallback(seed),
      wasFallback: true,
    };
  }

  return {
    response: cleaned,
    wasFallback: false,
  };
}

// Export internals for unit testing
export const _internals = {
  FALLBACK_RESPONSES,
  STRIP_PATTERNS,
  pickFallback,
  stripArtifacts,
};
