import { jest } from '@jest/globals';

// Mock global fetch before importing
const mockFetch = jest.fn();
global.fetch = mockFetch;

import { storeMemory, retrieveRelevantMemories, clearAll, _internals } from '../src/vectorMemoryManager.js';

describe('vectorMemoryManager', () => {
  beforeEach(() => {
    clearAll();
    jest.clearAllMocks();
  });

  test('cosineSimilarity calculates correctly', () => {
    const vecA = [1, 0];
    const vecB = [1, 0];
    const vecC = [0, 1];
    expect(_internals.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0);
    expect(_internals.cosineSimilarity(vecA, vecC)).toBeCloseTo(0);
  });

  test('cosineSimilarity handles zero vectors', () => {
    expect(_internals.cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  test('cosineSimilarity handles mismatched lengths', () => {
    expect(_internals.cosineSimilarity([1, 1], [1])).toBe(0);
  });

  describe('storeMemory and retrieveRelevantMemories', () => {
    const dummyEmbedding1 = [0.9, 0.1, 0.0];
    const dummyEmbedding2 = [0.1, 0.9, 0.0];
    
    test('stores and retrieves memories correctly', async () => {
      // Mock fetch responses
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: dummyEmbedding1 })
      }).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: dummyEmbedding2 })
      });

      await storeMemory('session1', 'I love apples', { intent: 'happy' });
      await storeMemory('session1', 'I hate bananas', { intent: 'stressed' });

      // Mock query embedding matching apples closely
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.85, 0.15, 0.0] })
      });

      const results = await retrieveRelevantMemories('session1', 'apples query', 1);
      
      expect(results.length).toBe(1);
      expect(results[0].text).toBe('I love apples');
      expect(results[0].metadata.intent).toBe('happy');
      expect(results[0].similarity).toBeGreaterThan(0.75);
    });

    test('deduplicates identical semantic memories (>0.9 threshold)', async () => {
      // Both memories will get the exact same vector to simulate >0.9 similarity
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ embedding: [1, 0, 0] })
      });

      const stored1 = await storeMemory('session2', 'I am stressed');
      const stored2 = await storeMemory('session2', 'I feel very stressed');

      expect(stored1).toBe(true);
      expect(stored2).toBe(false); // Should have been skipped

      const memMap = _internals.memoryStore.get('session2');
      expect(memMap.length).toBe(1); // Only 1 stored safely
    });

    test('enforces hard cap of MAX_MEMORIES_PER_SESSION', async () => {
      let counter = 0;
      mockFetch.mockImplementation(async () => {
        const vec = new Array(300).fill(0);
        vec[counter] = 1;
        counter++;
        return {
          ok: true,
          json: async () => ({ embedding: vec })
        };
      });

      // Store 205 items
      for (let i = 0; i < 205; i++) {
        await storeMemory('session-cap', `Memory ${i}`);
      }

      const memMap = _internals.memoryStore.get('session-cap');
      expect(memMap.length).toBe(200); // the exact CAP limit
      expect(memMap[0].text).toBe('Memory 5'); // the oldest ones got pushed out
    });

    test('filters out low similarity (<0.75)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [1, 0] })
      });

      await storeMemory('session-filter', 'Something distinct');

      // Query with orthogonal vector
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0, 1] })
      });

      const results = await retrieveRelevantMemories('session-filter', 'Orthogonal search');
      expect(results.length).toBe(0); // similarity is 0, which is < 0.75
    });

    test('handles fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(storeMemory('session-err', 'Test')).rejects.toThrow(/Failed to generate embedding/);
    });
  });
});
