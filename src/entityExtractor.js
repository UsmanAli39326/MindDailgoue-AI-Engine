// ─────────────────────────────────────────────────────────────
// entityExtractor.js
// Extract key names and details using low-overhead regex.
// No LLM calls — pure text processing for token efficiency.
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExtractedEntities
 * @property {string[]} names     - Proper names mentioned (e.g., Alex, Sarah)
 * @property {string[]} roles     - Relational roles (e.g., mother, boss)
 * @property {string[]} topics    - Key life areas or topics (e.g., work, school)
 */

// Patterns for Name Extraction
// Focuses on "My name is X" or "I'm X" or "Call me X"
const NAME_PATTERNS = [
  /(?:my name is|call me|this is) ([A-Z]?[a-z]+)/i, // Catch even lowercase for explicit names
  /([A-Z][a-z]+) here/i,
  /(?:[Ii]'m|[Ii] am) ([A-Z][A-Za-z]+)/ // Strict capitalization for I'm to avoid verbs
];

const NAME_EXCLUSIONS = [
  'having', 'feeling', 'going', 'doing', 'tired', 'sad', 'happy', 
  'scared', 'worried', 'anxious', 'fine', 'okay', 'well', 'stressed',
  'trying', 'thinking', 'not', 'just', 'still', 'really', 'very'
];

// Keywords for Role Extraction
const ROLE_KEYWORDS = [
  'mother', 'father', 'mom', 'dad', 'parent', 'sister', 'brother',
  'sibling', 'partner', 'husband', 'wife', 'spouse', 'girlfriend',
  'boyfriend', 'boss', 'manager', 'colleague', 'friend', 'doctor',
  'therapist', 'teacher', 'professor', 'lover'
];

// Keywords for Key Area/Topic Extraction
const TOPIC_KEYWORDS = [
  'work', 'job', 'office', 'career', 'school', 'university', 'college',
  'home', 'house', 'apartment', 'family', 'health', 'sleep', 'exercise',
  'diet', 'money', 'finance', 'debt', 'anxiety', 'stress', 'depression',
  'panic', 'fear', 'grief', 'trauma'
];

/**
 * Extract entities from cleaned text.
 * @param {string} text 
 * @returns {ExtractedEntities}
 */
export function extractEntities(text) {
  const result = {
    names: [],
    roles: [],
    topics: []
  };

  if (!text || typeof text !== 'string') return result;

  // 1. Extract Names
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      if (!NAME_EXCLUSIONS.includes(name.toLowerCase()) && !result.names.includes(name)) {
        result.names.push(name);
      }
    }
  }

  // 2. Extract Roles (Keyword Match)
  const tokens = text.toLowerCase().split(/\W+/);
  for (const token of tokens) {
    if (ROLE_KEYWORDS.includes(token) && !result.roles.includes(token)) {
      result.roles.push(token);
    }
    if (TOPIC_KEYWORDS.includes(token) && !result.topics.includes(token)) {
      result.topics.push(token);
    }
  }

  return result;
}
