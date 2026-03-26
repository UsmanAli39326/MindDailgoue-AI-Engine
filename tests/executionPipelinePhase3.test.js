import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn()
}));
jest.unstable_mockModule('../src/vectorMemoryManager.js', () => ({
  storeMemory: jest.fn(),
  retrieveRelevantMemories: jest.fn().mockResolvedValue([]),
  clearAll: jest.fn()
}));

describe('executionPipelinePhase3', () => {
  let executePhase3;
  let llmClientMock;
  let vectorMemoryMock;
  let userProfileManager;

  beforeAll(async () => {
    const client = await import('../src/llmClient.js');
    llmClientMock = client.callLLM;
    
    const vectorMem = await import('../src/vectorMemoryManager.js');
    vectorMemoryMock = vectorMem;

    userProfileManager = await import('../src/userProfileManager.js');
    
    const pipe = await import('../src/executionPipelinePhase3.js');
    executePhase3 = pipe.executePhase3;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userProfileManager.clearAll();
  });

  test('executes pipeline and stores memory appropriately', async () => {
    llmClientMock.mockResolvedValueOnce({ text: 'Safe therapeutic response', model: 'test' });

    // "I feel sad because my husband left" triggers memoryFilter 'high' and personal pattern
    const result = await executePhase3({
      sessionId: 'test-session',
      therapistId: 'compassionate-listener',
      input: 'I feel sad because my husband left me'
    });

    // LLM should be called
    expect(llmClientMock).toHaveBeenCalledTimes(1);

    // Vector memory store should be called because it passes filter
    expect(vectorMemoryMock.storeMemory).toHaveBeenCalledTimes(1);
    const storeArgs = vectorMemoryMock.storeMemory.mock.calls[0];
    expect(storeArgs[0]).toBe('test-session'); // session id
    expect(storeArgs[1]).toContain('husband'); // should be the compressed/truncated text
    expect(storeArgs[2].importance).toBe('high');

    // Vector memory retrieval should be called
    expect(vectorMemoryMock.retrieveRelevantMemories).toHaveBeenCalledTimes(1);

    // Profile should be updated
    expect(result.profileUpdated).toBe(true);
    expect(result.metadata.wasFallback).toBe(false);
  });

  test('does not store casual talk but still responds', async () => {
    llmClientMock.mockResolvedValueOnce({ text: 'Hello there!', model: 'test' });

    const result = await executePhase3({
      sessionId: 'test-session-2',
      therapistId: 'compassionate-listener',
      input: 'hi' // Too short, no emotions
    });

    expect(llmClientMock).toHaveBeenCalledTimes(1);
    expect(vectorMemoryMock.storeMemory).not.toHaveBeenCalled();
    expect(result.response).toBe('Hello there!');
  });
});
