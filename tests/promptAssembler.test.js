import { assemblePrompt, _internals } from '../src/promptAssembler.js';

describe('promptAssembler', () => {
  const mockPersona = {
    name: 'Test Therapist',
    style: 'Testing Style',
    tone: 'Testing Tone',
    personalityPrompt: 'You are a testing therapist.'
  };

  const basePhase1Output = {
    cleanedInput: 'I feel sad today',
    detectedIntent: 'sad',
    intentConfidence: 'high',
    riskSeverity: 'none',
    safetyCategory: null
  };

  const mockHistory = 'User: Hello\nAssistant: Hi there';

  test('assembles correctly with all standard sections', () => {
    const prompt = assemblePrompt({
      phase1Output: basePhase1Output,
      persona: mockPersona,
      recentHistory: mockHistory
    });

    // Contains Therapist Identity
    expect(prompt).toContain('[THERAPIST IDENTITY]');
    expect(prompt).toContain('Test Therapist — Testing Style');
    expect(prompt).toContain('Tone: Testing Tone');

    // Contains Personality
    expect(prompt).toContain('[PERSONALITY]');
    expect(prompt).toContain('You are a testing therapist.');

    // Contains Emotional State Injection
    expect(prompt).toContain('[USER EMOTIONAL STATE]');
    expect(prompt).toContain('Detected: sad (confidence: high)');
    expect(prompt).toContain(_internals.INTENT_TONE_GUIDANCE.sad);

    // Contains Conversation History
    expect(prompt).toContain('[CONVERSATION HISTORY]');
    expect(prompt).toContain('User: Hello\nAssistant: Hi there');

    // Contains Current Input
    expect(prompt).toContain('[CURRENT INPUT]');
    expect(prompt).toContain('I feel sad today');

    // Contains Instructions
    expect(prompt).toContain('[INSTRUCTIONS]');
    expect(prompt).toContain(_internals.THERAPEUTIC_INSTRUCTIONS);
    
    // Safety section should be missing since severity is none
    expect(prompt).not.toContain('[SAFETY CONTEXT]');
  });

  test('injects Safety Context when riskSeverity is present', () => {
    const highRiskOutput = {
      ...basePhase1Output,
      riskSeverity: 'medium',
      safetyCategory: 'self_harm'
    };

    const prompt = assemblePrompt({
      phase1Output: highRiskOutput,
      persona: mockPersona,
      recentHistory: mockHistory
    });

    expect(prompt).toContain('[SAFETY CONTEXT]');
    expect(prompt).toContain('medium risk related to self_harm');
  });

  test('handles missing or default values appropriately', () => {
    const minimalOutput = {
      cleanedInput: 'Just text'
    };

    const prompt = assemblePrompt({
      phase1Output: minimalOutput,
      persona: mockPersona,
      recentHistory: 'No previous conversation history.'
    });

    // Default intent
    expect(prompt).toContain('Detected: neutral (confidence: low)');
    expect(prompt).toContain('Just text');
    expect(prompt).not.toContain('[SAFETY CONTEXT]');
  });
});
