// ─────────────────────────────────────────────────────────────
// adaptiveResponseController.js
// Subtly alters instructions based on user profile.
// Must absolutely honor Constraint 5: DO NOT OVERRIDE PERSONA.
// ─────────────────────────────────────────────────────────────

export function getAdaptiveInstructions(userProfile) {
  if (!userProfile) return '';

  const instructions = [];

  let dominant = userProfile.dominantEmotion || 'calm';
  if (dominant === 'hopeful') dominant = 'happy';
  else if (dominant === 'angry') dominant = 'stressed';
  else if (dominant === 'confused' || dominant === 'neutral') dominant = 'calm';

  // Respond to dominant emotion
  if (dominant === 'anxious') {
    instructions.push('- Use a slightly slower, more reassuring conversational pace.');
  } else if (dominant === 'stressed') {
    instructions.push('- Prioritize profound validation of their stress and frustration before exploring solutions.');
  } else if (dominant === 'sad') {
    instructions.push('- Emphasize warmth, presence, and safe holding of their grief.');
  } else if (dominant === 'happy') {
    instructions.push('- Match their positive energy with warm, enthusiastic support and celebrate their progress.');
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
