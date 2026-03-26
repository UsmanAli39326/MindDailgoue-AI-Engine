import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn()
}));

describe('memoryCompressor', () => {
  let llmClientMock;
  let summarizeMemory;

  beforeAll(async () => {
    const client = await import('../src/llmClient.js');
    llmClientMock = client.callLLM;
    const module = await import('../src/memoryCompressor.js');
    summarizeMemory = module.summarizeMemory;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns exactly same text if very short (<150 chars)', async () => {
    const shortText = 'I am just feeling a bit tired today.';
    const result = await summarizeMemory(shortText);
    expect(result).toBe(shortText);
    expect(llmClientMock).not.toHaveBeenCalled();
  });

  test('calls LLM to summarize long text and strips wrapper', async () => {
    const longText = 'A'.repeat(200);

    llmClientMock.mockResolvedValueOnce({
      text: '"User feels very tired today"'
    });

    const result = await summarizeMemory(longText);
    expect(llmClientMock).toHaveBeenCalledTimes(1);
    expect(result).toBe('User feels very tired today'); // Quotes stripped
  });

  test('safely truncates if LLM fails', async () => {
    const longText = 'A'.repeat(200);

    llmClientMock.mockRejectedValueOnce(new Error('Network Error'));

    const result = await summarizeMemory(longText);
    expect(result.length).toBe(153); // 150 + '...'
    expect(result.endsWith('...')).toBe(true);
  });
});
