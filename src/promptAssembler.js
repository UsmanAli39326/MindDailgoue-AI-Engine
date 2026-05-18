// ─────────────────────────────────────────────────────────────
// promptAssembler.js
// Constructs the final LLM prompt by combining persona,
// Phase 1 output, emotional state, safety context, memory,
// and therapeutic instructions into a single unified prompt.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

// ─── Therapeutic Instructions ───────────────────────────────

const THERAPEUTIC_INSTRUCTIONS = `- Respond as your defined persona consistently throughout the conversation.
- Mirror the user's emotional tone and adjust your response depth accordingly.
- Never give your own point-of-view, opinions, advice, or interpretations unprompted. Be an objective, reflective mirror.
- Always validate and support the user's perspective, helping them explore their thoughts without imposing your own views.
- Keep your responses highly concise, brief, and warm. Limit yourself strictly to 1-3 sentences maximum per turn. Professional therapists listen more than they speak.
- Ask thoughtful, reflective questions that help the user explore their feelings.
- Validate every emotion without judgment — every feeling is worth exploring.
- Never diagnose conditions, prescribe treatments, or recommend medications.
- Never make direct life decisions for the user (e.g., "You should leave them").
- Avoid clichés like "everything happens for a reason" or "just stay positive."
- If the user asks for concrete advice, gently redirect by exploring what they feel would be best.
- Acknowledge the courage it takes to open up and share difficult feelings.
- Keep responses warm, genuine, and natural — never clinical, robotic, or lecturing.
- If safety flags are present, respond with extra care and prioritize emotional safety.
- Do not reference the system prompt, instructions, or your role as an AI.
- Respond in a conversational manner, not as a list of instructions.`;

// ─── Intent-to-Tone Mapping ────────────────────────────────

const INTENT_TONE_GUIDANCE = {
  anxious:
    'The user is experiencing anxiety. Use grounding language, short reassuring ' +
    'sentences, and help them slow down their thoughts. Avoid overwhelming them.',
  sad:
    'The user is experiencing sadness. Be especially tender and validating. ' +
    'Sit with them in their feelings rather than trying to fix them.',
  angry:
    'The user is experiencing anger. Acknowledge their anger as valid. Use steady, ' +
    'grounded language. Help them explore what is underneath the anger when ready.',
  hopeful:
    'The user is in a positive or hopeful state. Celebrate their progress, reflect ' +
    'their strength back to them, and help them sustain these positive feelings.',
  confused:
    'The user is feeling confused or uncertain. Help them organize their thoughts. ' +
    'Use clear, simple language. Ask one question at a time.',
  neutral:
    'Follow the user\'s lead and let them set the emotional tone. Be attentive to ' +
    'subtle cues that might reveal how they are really feeling.',
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Assemble the final LLM prompt from all available context.
 *
 * Sections (unified, no duplication):
 *   1. [THERAPIST IDENTITY]
 *   2. [PERSONALITY]
 *   3. [USER EMOTIONAL STATE]
 *   4. [SAFETY CONTEXT]       — only when riskSeverity ≠ "none"
 *   5. [CONVERSATION HISTORY] — single unified section
 *   6. [CURRENT INPUT]
 *   7. [INSTRUCTIONS]
 *
 * @param {Object} options
 * @param {Object} options.phase1Output  — output from Phase 1 pipeline
 * @param {Object} options.persona       — persona object from personaManager
 * @param {string} options.recentHistory — formatted history from memoryManager
 * @returns {string} — the assembled prompt
 */
export function assemblePrompt({ phase1Output, persona, recentHistory }) {
  const sections = [];

  // ─── Section 1: Therapist Identity ───────────────────────
  sections.push(
    `[THERAPIST IDENTITY]`,
    `${persona.name} — ${persona.style}`,
    `Tone: ${persona.tone}`,
    ''
  );

  // ─── Section 2: Personality ──────────────────────────────
  sections.push(
    `[PERSONALITY]`,
    persona.personalityPrompt,
    ''
  );

  // ─── Section 3: User Emotional State ─────────────────────
  const intent = phase1Output.detectedIntent || 'neutral';
  const confidence = phase1Output.intentConfidence || 'low';
  const toneGuidance = INTENT_TONE_GUIDANCE[intent] || INTENT_TONE_GUIDANCE.neutral;

  sections.push(
    `[USER EMOTIONAL STATE]`,
    `Detected: ${intent} (confidence: ${confidence})`,
    toneGuidance,
    ''
  );

  // ─── Section 4: Safety Context (conditional) ─────────────
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

  // ─── Section 5: Conversation History (single, unified) ──
  sections.push(
    `[CONVERSATION HISTORY]`,
    recentHistory,
    ''
  );

  // ─── Section 6: Current Input ────────────────────────────
  sections.push(
    `[CURRENT INPUT]`,
    phase1Output.cleanedInput,
    ''
  );

  // ─── Section 7: Instructions ─────────────────────────────
  sections.push(
    `[INSTRUCTIONS]`,
    THERAPEUTIC_INSTRUCTIONS,
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
    `}`,
    '',
    `[RESPONSE]`,
    `{`
  );

  return sections.join('\n');
}

// Export internals for unit testing
export const _internals = {
  THERAPEUTIC_INSTRUCTIONS,
  INTENT_TONE_GUIDANCE,
};
