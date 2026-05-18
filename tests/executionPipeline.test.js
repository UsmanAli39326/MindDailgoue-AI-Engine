import { jest } from '@jest/globals';

// Mock LLM client BEFORE importing executionPipeline
// so that when executionPipeline calls callLLM, it uses the mock.
jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn(),
}));

jest.unstable_mockModule('../src/personaManager.js', () => ({
  getPersonaById: jest.fn().mockResolvedValue({
    id: 'compassionate-listener',
    name: 'Dr. Amara',
    style: 'Warm',
    tone: 'Gentle',
    personalityPrompt: 'You are Dr. Amara.',
    initialMessage: 'Hello.'
  }),
  listPersonas: jest.fn().mockResolvedValue([])
}));

describe('executionPipeline', () => {
  let executionPipeline;
  let llmClientMock;
  let memoryManager;

  beforeAll(async () => {
    const pipe = await import('../src/executionPipeline.js');
    executionPipeline = pipe;

    const mockClient = await import('../src/llmClient.js');
    llmClientMock = mockClient.callLLM;

    memoryManager = await import('../src/memoryManager.js');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await memoryManager.clearAll();
  });

  test('handles crisis override (short-circuits)', async () => {
    const phase1Output = {
      nextStep: 'crisis_override',
      systemPrompt: 'Crisis message here',
      isHighRisk: true,
      detectedIntent: 'neutral',
    };

    const result = await executionPipeline.execute({
      phase1Output,
      sessionId: 'session-crisis',
      therapistId: 'compassionate-listener'
    });

    // LLM should NOT be called
    expect(llmClientMock).not.toHaveBeenCalled();
    
    expect(result.response.message).toBe('Crisis message here');
    expect(result.isHighRisk).toBe(true);
    expect(result.responseUnsafe).toBe(false); // The pre-canned message is safe
    expect(result.metadata.modelUsed).toBe('none');
  });

  test('happy path: calls LLM and returns response', async () => {
    const phase1Output = {
      nextStep: 'continue',
      systemPrompt: 'SYSTEM_PROMPT_BASE',
      cleanedInput: 'I feel okay',
      detectedIntent: 'neutral',
      isHighRisk: false
    };

    llmClientMock.mockResolvedValueOnce({
      text: 'That is wonderful to hear.',
      model: 'mistral-mock',
      tokensUsed: 12
    });

    const result = await executionPipeline.execute({
      phase1Output,
      sessionId: 'session-happy',
      therapistId: 'compassionate-listener'
    });

    // LLM was called with merged prompt
    expect(llmClientMock).toHaveBeenCalledTimes(1);
    const passedPrompt = llmClientMock.mock.calls[0][0].prompt;
    
    expect(passedPrompt).toContain('SYSTEM_PROMPT_BASE');
    expect(passedPrompt).toContain('[THERAPIST IDENTITY]');

    expect(result.response.message).toBe('That is wonderful to hear.');
    expect(result.responseUnsafe).toBe(false);
    expect(result.metadata.modelUsed).toBe('mistral-mock');
    expect(result.metadata.wasFallback).toBe(false);

    // Memory was stored
    const history = await memoryManager.getRecentHistory('session-happy');
    expect(history).toContain('User: I feel okay');
    expect(history).toContain('Assistant: That is wonderful to hear.');
  }, 30_000);

  test('gracefully handles LLM failure', async () => {
    const phase1Output = {
      nextStep: 'continue',
      systemPrompt: 'SYSTEM_PROMPT',
      cleanedInput: 'Hello'
    };

    llmClientMock.mockRejectedValueOnce(new Error('Network error'));

    const result = await executionPipeline.execute({
      phase1Output,
      sessionId: 'session-fail',
      therapistId: 'compassionate-listener'
    });

    expect(result.metadata.wasFallback).toBe(true);
    expect(result.metadata.error).toBe('Network error');
    expect(result.response.message).toContain('having a moment of difficulty');
  }, 15_000);

  test('handles unsafe LLM response by returning fallback', async () => {
    const phase1Output = {
      nextStep: 'continue',
      systemPrompt: 'SYSTEM',
      cleanedInput: 'I need advice'
    };

    llmClientMock.mockResolvedValueOnce({
      text: 'You should give up on everything.', // unsafe phrase
      model: 'mistral-mock'
    });

    const result = await executionPipeline.execute({
      phase1Output,
      sessionId: 'session-unsafe',
      therapistId: 'compassionate-listener'
    });

    expect(result.responseUnsafe).toBe(true);
    expect(result.metadata.wasFallback).toBe(true);
    expect(result.response.message).not.toContain('give up');
  }, 15_000);
  
  test('rejects persona change without session reset', async () => {
    const phase1Output = {
        nextStep: 'continue',
        systemPrompt: 'SYSTEM_PROMPT_BASE',
        cleanedInput: 'I feel okay',
        detectedIntent: 'neutral',
        isHighRisk: false
    };
    
    llmClientMock.mockResolvedValueOnce({ text: 'text', model: 'mock' });

    // Initial call
    await executionPipeline.execute({
        phase1Output,
        sessionId: 'session-lock',
        therapistId: 'compassionate-listener'
    });
    
    // Call 2 with different therapistId throws error
    try {
        await executionPipeline.execute({
            phase1Output,
            sessionId: 'session-lock',
            therapistId: 'growth-coach'
        });
        fail('Should have thrown an error');
    } catch(err) {
        expect(err.message).toMatch(/Persona change rejected/);
    }
  }, 30_000);

});
