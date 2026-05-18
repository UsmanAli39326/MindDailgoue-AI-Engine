// ─────────────────────────────────────────────────────────────
// enhancedPromptAssembler.js
// Assembles the final prompt for Phase 3, merging the core Phase 2
// elements with the new Phase 3 contextual injections seamlessly.
// ─────────────────────────────────────────────────────────────

import { _internals as phase2Internals } from './promptAssembler.js';

export function assembleEnhancedPrompt({
  phase1Output,
  persona,
  recentHistory,
  memoryContext,
  profileContext,
  adaptiveInstructions
}) {
  const sections = [];

  // 1. Therapist Identity
  sections.push(
    `[THERAPIST IDENTITY]`,
    `${persona.name} — ${persona.style}`,
    `Tone: ${persona.tone}`,
    ''
  );

  // 2. Personality
  sections.push(
    `[PERSONALITY]`,
    persona.personalityPrompt,
    ''
  );

  // 3. User Emotional State
  const intent = phase1Output.detectedIntent || 'neutral';
  const confidence = phase1Output.intentConfidence || 'low';
  const toneGuidance = phase2Internals.INTENT_TONE_GUIDANCE[intent] || phase2Internals.INTENT_TONE_GUIDANCE.neutral;

  sections.push(
    `[USER EMOTIONAL STATE]`,
    `Detected: ${intent} (confidence: ${confidence})`,
    toneGuidance,
    ''
  );

  // 4. Safety Context
  if (phase1Output.riskSeverity && phase1Output.riskSeverity !== 'none') {
    const category = phase1Output.safetyCategory || 'unspecified';
    sections.push(
      `[SAFETY CONTEXT]`,
      `User may be experiencing ${phase1Output.riskSeverity} risk related to ${category}.`,
      `Respond carefully, avoid escalation, and prioritize emotional safety.`,
      `Do not minimize their experience, but do not amplify distress either.`,
      ''
    );
  }

  // 5. User Profile (PHASE 3)
  if (profileContext) {
    sections.push(profileContext, '');
  }

  // 6. Relevant Memories (PHASE 3)
  if (memoryContext) {
    sections.push(memoryContext, '');
  }

  // 7. Conversation History
  sections.push(
    `[CONVERSATION HISTORY]`,
    recentHistory,
    ''
  );

  // 8. Current Input
  sections.push(
    `[CURRENT INPUT]`,
    phase1Output.cleanedInput,
    ''
  );

  // 9. Instructions (Base + Adaptive Phase 3)
  sections.push(
    `[INSTRUCTIONS]`,
    phase2Internals.THERAPEUTIC_INSTRUCTIONS,
    '',
    `You MUST respond ONLY with a valid JSON object. Do not include any text, markdown formatting (like \`\`\`json), or conversational prose outside the JSON block.`,
    `The JSON object MUST follow this exact structure:`,
    `{`,
    `  "message": "Your warm, empathetic, conversational response here (e.g. speaking directly as Dr. Amara)",`,
    `  "emotion": "one of: anxious, calm, sad, angry, hopeful, neutral",`,
    `  "intensity": 0.0 to 1.0 (float),`,
    `  "stress_level": 0.0 to 1.0 (float),`,
    `  "crisis": true or false,`,
    `  "suggestions": ["suggestion 1", "suggestion 2"],`,
    `  "mood_tag": "short descriptive tag"`,
    `}`
  );

  if (adaptiveInstructions) {
    sections.push('', adaptiveInstructions);
  }

  // 10. Clear Response Cue
  sections.push(
    '',
    `[RESPONSE]`,
    `{`
  );

  return sections.join('\n');
}
