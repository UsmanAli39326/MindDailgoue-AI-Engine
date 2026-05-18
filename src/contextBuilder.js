// ─────────────────────────────────────────────────────────────
// contextBuilder.js
// Assembles the string payloads for memory and user profile.
// ─────────────────────────────────────────────────────────────

export function buildMemoryContext(relevantMemories, crossSessionContext = '') {
  let context = '';

  if (crossSessionContext && crossSessionContext.trim().length > 0) {
    context += crossSessionContext.trim() + '\n\n';
  }

  if (relevantMemories && relevantMemories.length > 0) {
    const facts = relevantMemories.map((m, index) => {
      return `[${index + 1}] ${m.text}`;
    }).join('\n');

    context += `[RELEVANT PAST MEMORIES]
You recall the following context from earlier in the user's history:
${facts}`;
  }

  return context.trim();
}

export function buildProfileContext(userProfile, userBasicInfo = null) {
  if (!userProfile && !userBasicInfo) return '';

  const lines = [];

  if (userBasicInfo) {
    if (userBasicInfo.name) {
      lines.push(`Registered Name: ${userBasicInfo.name}`);
    }
    if (userBasicInfo.background) {
      lines.push(`User Background: ${userBasicInfo.background}`);
    }
    if (userBasicInfo.name) {
      lines.push(`IMPORTANT DIRECTIVE: Address the user by their name ("${userBasicInfo.name}") occasionally and naturally in your response to make the conversation feel more personal.`);
    }
  }

  if (userProfile) {
    if (userProfile.dominantEmotion && userProfile.dominantEmotion !== 'neutral') {
      lines.push(`Dominant historical emotion: ${userProfile.dominantEmotion}`);
    }

    if (userProfile.recurringThemes && userProfile.recurringThemes.length > 0) {
      lines.push(`Known stressors/themes: ${userProfile.recurringThemes.join(', ')}`);
    }

    if (userProfile.names && userProfile.names.length > 0) {
      lines.push(`Mentioned Names: ${userProfile.names.join(', ')}`);
    }
    if (userProfile.roles && userProfile.roles.length > 0) {
      lines.push(`Mentioned Relations: ${userProfile.roles.join(', ')}`);
    }
    if (userProfile.topics && userProfile.topics.length > 0) {
      lines.push(`Life Topics: ${userProfile.topics.join(', ')}`);
    }
  }

  if (lines.length === 0) return '';

  return `[USER PROFILE]
${lines.join('\n')}`;
}
