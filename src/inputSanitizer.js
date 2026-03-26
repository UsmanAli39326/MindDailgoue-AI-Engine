// ─────────────────────────────────────────────────────────────
// inputSanitizer.js
// Cleans and normalizes raw user input for downstream processing.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

const MIN_INPUT_LENGTH = 1;
const MAX_INPUT_LENGTH = 5000;

/**
 * Strip HTML/XML tags from input.
 * @param {string} text
 * @returns {string}
 */
function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, '');
}

/**
 * Remove control characters (except newlines and tabs) and
 * zero‑width / invisible Unicode characters.
 * @param {string} text
 * @returns {string}
 */
function removeControlCharacters(text) {
  // Remove C0/C1 control chars except \n \r \t
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  // Remove zero-width characters
  cleaned = cleaned.replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '');
  return cleaned;
}

/**
 * Normalize whitespace: collapse runs of spaces/tabs into a single space,
 * preserve meaningful newlines but collapse multiples into one.
 * @param {string} text
 * @returns {string}
 */
function normalizeWhitespace(text) {
  // Replace tabs with spaces
  let normalized = text.replace(/\t/g, ' ');
  // Collapse multiple spaces into one
  normalized = normalized.replace(/ {2,}/g, ' ');
  // Collapse 3+ consecutive newlines into 2
  normalized = normalized.replace(/\n{3,}/g, '\n\n');
  // Trim whitespace from each line
  normalized = normalized
    .split('\n')
    .map((line) => line.trim())
    .join('\n');
  return normalized.trim();
}

/**
 * Collapse repeated punctuation:
 *   "!!!" → "!"   "???" → "?"   "..."  stays "..." (ellipsis is meaningful)
 * @param {string} text
 * @returns {string}
 */
function collapsePunctuation(text) {
  // Collapse 2+ of the same punctuation into one (except periods — allow max 3 for ellipsis)
  let result = text.replace(/([!?])\1{1,}/g, '$1');
  // Collapse 4+ periods into ellipsis
  result = result.replace(/\.{4,}/g, '...');
  return result;
}

/**
 * Normalize Unicode to NFC form for consistent comparison.
 * @param {string} text
 * @returns {string}
 */
function normalizeUnicode(text) {
  return text.normalize('NFC');
}

/**
 * Validate input length constraints.
 * @param {string} text
 * @returns {{ valid: boolean, error?: string }}
 */
function validateLength(text) {
  if (text.length < MIN_INPUT_LENGTH) {
    return { valid: false, error: 'Input is empty or too short to process.' };
  }
  if (text.length > MAX_INPUT_LENGTH) {
    return {
      valid: false,
      error: `Input exceeds maximum length of ${MAX_INPUT_LENGTH} characters.`,
    };
  }
  return { valid: true };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Sanitize and normalize raw user input.
 *
 * Pipeline order:
 *   1. Trim raw input
 *   2. Strip HTML tags
 *   3. Remove control / invisible characters
 *   4. Normalize Unicode (NFC)
 *   5. Normalize whitespace
 *   6. Collapse repeated punctuation
 *   7. Lowercase
 *   8. Validate length constraints
 *
 * @param {string} rawInput — the raw user message
 * @returns {{ success: boolean, cleanedInput?: string, error?: string }}
 */
export function sanitize(rawInput) {
  if (typeof rawInput !== 'string') {
    return { success: false, error: 'Input must be a string.' };
  }

  let text = rawInput.trim();

  // Early exit for empty input before processing
  if (text.length === 0) {
    return { success: false, error: 'Input is empty or too short to process.' };
  }

  text = stripHtmlTags(text);
  text = removeControlCharacters(text);
  text = normalizeUnicode(text);
  text = normalizeWhitespace(text);
  text = collapsePunctuation(text);
  text = text.toLowerCase();

  const validation = validateLength(text);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  return { success: true, cleanedInput: text };
}

// Export internals for unit testing
export const _internals = {
  stripHtmlTags,
  removeControlCharacters,
  normalizeWhitespace,
  collapsePunctuation,
  normalizeUnicode,
  validateLength,
  MIN_INPUT_LENGTH,
  MAX_INPUT_LENGTH,
};
