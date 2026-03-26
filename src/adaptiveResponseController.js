// ─────────────────────────────────────────────────────────────
// adaptiveResponseController.js
// Subtly alters instructions based on user profile.
// Must absolutely honor Constraint 5: DO NOT OVERRIDE PERSONA.
// ─────────────────────────────────────────────────────────────

export function getAdaptiveInstructions(userProfile) {
  if (!userProfile) return '';

  const instructions = [];

  // Respond to dominant emotion
  if (userProfile.dominantEmotion === 'anxious') {
    instructions.push('- Use a slightly slower, more reassuring conversational pace.');
  } else if (userProfile.dominantEmotion === 'angry') {
    instructions.push('- Prioritize profound validation of their frustration before exploring solutions.');
  } else if (userProfile.dominantEmotion === 'sad') {
    instructions.push('- Emphasize warmth, presence, and safe holding of their grief.');
  }

  // Acknowledge stated tone preferences
  if (userProfile.tonePreference === 'gentle') {
    instructions.push('- Soften language and avoid overly clinical terms.');
  } else if (userProfile.tonePreference === 'direct') {
    instructions.push('- Provide slightly more structure and actionable framing.');
  }

  if (instructions.length === 0) return '';

  return `
[ADAPTIVE INSTRUCTIONS]
(Constraint: Apply these subtle adaptations WITHOUT overriding your primary Therapist Identity or Personality.)
${instructions.join('\n')}
`.trim();
}
