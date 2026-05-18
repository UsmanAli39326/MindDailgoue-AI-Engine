// ─────────────────────────────────────────────────────────────
// userProfileManager.js
// Maintains a persistent user profile updating over time.
// Employs weighted averaging for intents to prevent "profile drift".
// ─────────────────────────────────────────────────────────────

// Data Structure:
// profileStore: Map<sessionId, {
//    intentHistory: Record<string, number>, // weighted occurrence map
//    dominantEmotion: string,
//    recurringThemes: Set<string>,
//    tonePreference: string | null,
//    names: Set<string>,
//    roles: Set<string>,
//    topics: Set<string>
// }>

const profileStore = new Map();

// ─── Constants ─────────────────────────────────────────────
const DECAY_FACTOR = 0.9; // Emphasizes recent emotions slightly but keeps history long term
const THEME_WEIGHT_INCREMENT = 1.0;

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function createEmptyProfile() {
  return {
    intentHistory: {
      happy: 0,
      calm: 0,
      anxious: 0,
      sad: 0,
      stressed: 0
    },
    dominantEmotion: 'calm',
    recurringThemes: new Set(),
    tonePreference: null,
    names: new Set(),
    roles: new Set(),
    topics: new Set()
  };
}

/**
 * Calculate the dominant emotion using a weighted average so it remains stable.
 * @param {Record<string, number>} intentHistory
 * @returns {string} 
 */
function calculateDominantEmotion(intentHistory) {
  let dominant = 'calm';
  let maxWeight = -1;

  for (const [intent, weight] of Object.entries(intentHistory)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      dominant = intent;
    }
  }

  // Fallback to calm if weights are tiny
  if (maxWeight < 0.5) return 'calm';
  return dominant;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Get a user profile. Initializes if empty.
 * @param {string} sessionId
 * @returns {Object}
 */
export function getProfile(sessionId) {
  if (!profileStore.has(sessionId)) {
    profileStore.set(sessionId, createEmptyProfile());
  }

  const profile = profileStore.get(sessionId);
  // Return plain object (convert Set to Array)
  return {
    dominantEmotion: profile.dominantEmotion,
    recurringThemes: Array.from(profile.recurringThemes),
    tonePreference: profile.tonePreference,
    names: Array.from(profile.names),
    roles: Array.from(profile.roles),
    topics: Array.from(profile.topics)
  };
}

/**
 * Update the user profile incrementally.
 *
 * @param {string} sessionId
 * @param {Object} newData
 * @param {string} [newData.intent]         — single new intent from latest message
 * @param {string} [newData.theme]          — extracted theme or category to add
 * @param {string} [newData.tonePreference] — explicitly stated tone preference
 * @param {Object} [newData.entities]       — extracted entities from entityExtractor
 */
export function updateProfile(sessionId, newData = {}) {
  const profile = profileStore.has(sessionId) 
    ? profileStore.get(sessionId) 
    : createEmptyProfile();

  let intent = newData.intent;
  if (intent) {
    if (intent === 'hopeful') intent = 'happy';
    else if (intent === 'angry') intent = 'stressed';
    else if (intent === 'confused' || intent === 'neutral') intent = 'calm';
  }

  // CONSTRAINT: Weighted Average update for emotional drift
  if (intent && profile.intentHistory[intent] !== undefined) {
    // Apply decay to all existing histories to normalize bounds over a very long session
    for (const key of Object.keys(profile.intentHistory)) {
      profile.intentHistory[key] *= DECAY_FACTOR;
    }
    // Add weight to new intent
    profile.intentHistory[intent] += THEME_WEIGHT_INCREMENT;
    
    // Recalculate dominant emotion
    profile.dominantEmotion = calculateDominantEmotion(profile.intentHistory);
  }

  if (newData.theme) {
    profile.recurringThemes.add(newData.theme);
  }

  if (newData.tonePreference) {
    profile.tonePreference = newData.tonePreference;
  }

  if (newData.entities) {
    const { names, roles, topics } = newData.entities;
    if (names) names.forEach(n => profile.names.add(n));
    if (roles) roles.forEach(r => profile.roles.add(r));
    if (topics) topics.forEach(t => profile.topics.add(t));
  }

  profileStore.set(sessionId, profile);
}

export function clearAll() {
  profileStore.clear();
}

export const _internals = {
  calculateDominantEmotion,
  profileStore
};
