import { assembleEnhancedPrompt } from '../src/enhancedPromptAssembler.js';

describe('enhancedPromptAssembler', () => {
  const mockPhase1Output = {
    detectedIntent: 'sad',
    intentConfidence: 'high',
    cleanedInput: 'I miss my dog',
    riskSeverity: 'none'
  };

  const mockPersona = {
    name: 'Dr. Test',
    style: 'Empathic',
    tone: 'Warm',
    personalityPrompt: 'You are warm.'
  };

  test('assembles correctly with all context injected', () => {
    const memoryContext = '[RELEVANT PAST MEMORIES]\n[1] User loves dogs';
    const profileContext = '[USER PROFILE]\nDominant historical emotion: anxious';
    const adaptiveInstructions = '[ADAPTIVE INSTRUCTIONS]\n- Be gentle';

    const prompt = assembleEnhancedPrompt({
      phase1Output: mockPhase1Output,
      persona: mockPersona,
      recentHistory: 'User: Hi\nAssistant: Hello',
      memoryContext,
      profileContext,
      adaptiveInstructions
    });

    expect(prompt).toContain('[THERAPIST IDENTITY]');
    expect(prompt).toContain('[USER EMOTIONAL STATE]');
    expect(prompt).toContain('[1] User loves dogs'); // Memory injected
    expect(prompt).toContain('Dominant historical emotion: anxious'); // Profile injected
    expect(prompt).toContain('[ADAPTIVE INSTRUCTIONS]');
    expect(prompt).toContain('- Be gentle');
  });

  test('does not insert undefined optional contexts', () => {
    const prompt = assembleEnhancedPrompt({
      phase1Output: mockPhase1Output,
      persona: mockPersona,
      recentHistory: 'User: Hi\nAssistant: Hello',
      memoryContext: '',
      profileContext: '',
      adaptiveInstructions: ''
    });

    expect(prompt).not.toContain('[RELEVANT PAST MEMORIES]');
    expect(prompt).not.toContain('[USER PROFILE]');
    expect(prompt).not.toContain('[ADAPTIVE INSTRUCTIONS]');
  });
});
