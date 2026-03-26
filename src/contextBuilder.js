// ─────────────────────────────────────────────────────────────
// contextBuilder.js
// Assembles the string payloads for memory and user profile.
// ─────────────────────────────────────────────────────────────

export function buildMemoryContext(relevantMemories) {
  if (!relevantMemories || relevantMemories.length === 0) {
    return '';
  }

  const facts = relevantMemories.map((m, index) => {
    return `[${index + 1}] ${m.text}`;
  }).join('\n');

  return `[RELEVANT PAST MEMORIES]
You recall the following context from earlier in the user's history:
${facts}`;
}

export function buildProfileContext(userProfile) {
  if (!userProfile) return '';

  const lines = [];

  if (userProfile.dominantEmotion && userProfile.dominantEmotion !== 'neutral') {
    lines.push(`Dominant historical emotion: ${userProfile.dominantEmotion}`);
  }

  if (userProfile.recurringThemes && userProfile.recurringThemes.length > 0) {
    lines.push(`Known stressors/themes: ${userProfile.recurringThemes.join(', ')}`);
  }

  if (userProfile.names && userProfile.names.length > 0) {
    lines.push(`User Name: ${userProfile.names.join(', ')}`);
  }
  if (userProfile.roles && userProfile.roles.length > 0) {
    lines.push(`Mentioned Relations: ${userProfile.roles.join(', ')}`);
  }
  if (userProfile.topics && userProfile.topics.length > 0) {
    lines.push(`Life Topics: ${userProfile.topics.join(', ')}`);
  }

  if (lines.length === 0) return '';

  return `[USER PROFILE]
${lines.join('\n')}`;
}
