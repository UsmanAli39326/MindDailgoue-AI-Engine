// ─────────────────────────────────────────────────────────────
// aiGatewayRouting.test.js
// Specialized integration tests for the Dynamic AI Gateway.
// Asserts hosted/local dynamic completions, timeouts, and embeddings.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';

describe('Dynamic AI Gateway Routing & Fallbacks', () => {
  let callLLM;
  let storeMemory;
  let retrieveRelevantMemories;
  let originalEnv;

  beforeAll(async () => {
    originalEnv = { ...process.env };

    // Set keys needed to initialize modules without throwing during import
    process.env.OPENROUTER_API_KEY = 'mock_key';

    // Mock global fetch to intercept outgoing gateway calls
    global.fetch = jest.fn();

    // Import LLM Client and Vector Memory Manager
    const llmModule = await import('../src/llmClient.js');
    callLLM = llmModule.callLLM;

    const vectorModule = await import('../src/vectorMemoryManager.js');
    storeMemory = vectorModule.storeMemory;
    retrieveRelevantMemories = vectorModule.retrieveRelevantMemories;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'mock_key';
  });

  describe('callLLM - Completion API Gateway Routing', () => {
    test('routes to Local Ollama by default when USE_HOSTED_AI is not active', async () => {
      process.env.USE_HOSTED_AI = 'false';
      process.env.OLLAMA_MODEL = 'mistral';

      // Mock Ollama success response
      const mockOllamaResponse = {
        ok: true,
        json: async () => ({
          model: 'mistral',
          message: {
            role: 'assistant',
            content: 'Hello from local Ollama!'
          }
        })
      };
      global.fetch.mockResolvedValueOnce(mockOllamaResponse);

      const result = await callLLM({ prompt: 'Hello local AI' });

      expect(result.text).toBe('Hello from local Ollama!');
      expect(result.model).toBe('mistral');
      expect(global.fetch).toHaveBeenCalled();

      // Check request URL and payload
      const [url, requestOptions] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/chat');
      
      const body = JSON.parse(requestOptions.body);
      expect(body.model).toBe('mistral');
      expect(body.messages[0].content).toBe('Hello local AI');
      expect(body.stream).toBe(false);
    });

    test('routes to Hosted OpenRouter when USE_HOSTED_AI is active', async () => {
      process.env.USE_HOSTED_AI = 'true';
      process.env.OPENROUTER_MODEL = 'google/gemma-2-9b-it:free';

      // Mock OpenRouter success response
      const mockHostedResponse = {
        ok: true,
        json: async () => ({
          model: 'google/gemma-2-9b-it:free',
          choices: [
            {
              message: {
                content: 'Hello from the cloud!'
              }
            }
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 5,
            total_tokens: 15
          }
        })
      };
      global.fetch.mockResolvedValueOnce(mockHostedResponse);

      const result = await callLLM({ prompt: 'Hello cloud AI', model: 'google/gemma-2-9b-it:free' });

      expect(result.text).toBe('Hello from the cloud!');
      expect(result.model).toBe('google/gemma-2-9b-it:free');
      expect(result.tokensUsed).toBe(15);

      const [url, requestOptions] = global.fetch.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(requestOptions.headers.Authorization).toContain('Bearer ');

      const body = JSON.parse(requestOptions.body);
      expect(body.model).toBe('google/gemma-2-9b-it:free');
      expect(body.messages[0].content).toBe('Hello cloud AI');
    });

    test('enforces strict 15-second execution timeout in hosted mode', async () => {
      process.env.USE_HOSTED_AI = 'true';

      // Mock fetch to simulate dynamic abort timeout trigger
      const abortError = new Error('The user aborted a request.');
      abortError.name = 'AbortError';
      global.fetch.mockRejectedValueOnce(abortError);

      await expect(callLLM({ prompt: 'Hello quick timeout' })).rejects.toThrow(
        /timed out after/
      );
    });
  });

  describe('getEmbedding - Semantic Embeddings Routing & Failovers', () => {
    test('uses Local Ollama nomic-embed-text embeddings by default', async () => {
      process.env.USE_HOSTED_AI = 'false';

      // Mock local Ollama embedding response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: [0.1, 0.2, 0.3]
        })
      });

      // Trigger storeMemory which calls getEmbedding internally
      const mockSessionId = 'test-session';
      const stored = await storeMemory(mockSessionId, 'I am anxious');

      expect(stored).toBe(true);
      expect(global.fetch).toHaveBeenCalled();

      const [url, requestOptions] = global.fetch.mock.calls[0];
      expect(url).toBe('http://localhost:11434/api/embeddings');

      const body = JSON.parse(requestOptions.body);
      expect(body.model).toBe('nomic-embed-text');
      expect(body.prompt).toBe('I am anxious');
    });

    test('uses Hosted Cloud OpenAI/OpenRouter embeddings when USE_HOSTED_AI is active', async () => {
      process.env.USE_HOSTED_AI = 'true';
      process.env.HOSTED_EMBEDDING_URL = 'https://openrouter.ai/api/v1/embeddings';
      process.env.HOSTED_EMBEDDING_MODEL = 'openai/text-embedding-3-small';

      // Mock Hosted embedding response (returns OpenAI layout: { data: [{ embedding: [...] }] })
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.9, 0.8, 0.7] }]
        })
      });

      // Clear memoryStore for testing
      const vectorModule = await import('../src/vectorMemoryManager.js');
      vectorModule.clearAll();

      const stored = await storeMemory('session-hosted', 'I am calm');

      expect(stored).toBe(true);
      expect(global.fetch).toHaveBeenCalled();

      const [url, requestOptions] = global.fetch.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/embeddings');

      const body = JSON.parse(requestOptions.body);
      expect(body.model).toBe('openai/text-embedding-3-small');
      expect(body.input).toBe('I am calm');
    });

    test('self-heals and fails over to local Ollama if Hosted Cloud embedding fails', async () => {
      process.env.USE_HOSTED_AI = 'true';
      process.env.HOSTED_EMBEDDING_URL = 'https://openrouter.ai/api/v1/embeddings';

      // Mock first fetch (hosted) to fail with HTTP 500 error
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      // Mock second fetch (fallback local Ollama embeddings) to succeed
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          embedding: [0.5, 0.6, 0.7]
        })
      });

      const vectorModule = await import('../src/vectorMemoryManager.js');
      vectorModule.clearAll();

      const stored = await storeMemory('session-failover', 'Failover testing');

      expect(stored).toBe(true);
      // Ensure fetch was called twice: once for hosted (which failed) and once for local fallback
      expect(global.fetch).toHaveBeenCalledTimes(2);

      const [hostedUrl] = global.fetch.mock.calls[0];
      const [localUrl] = global.fetch.mock.calls[1];

      expect(hostedUrl).toBe('https://openrouter.ai/api/v1/embeddings');
      expect(localUrl).toBe('http://localhost:11434/api/embeddings');
    });
  });
});
