// ─────────────────────────────────────────────────────────────
// sessionSummarizer.test.js
// Tests for session summarizer logic.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import { shouldSummarize, _internals } from '../src/services/sessionSummarizer.js';

jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn()
}));

describe('sessionSummarizer', () => {
  let callLLMMock;
  let summarizeAndStore;

  beforeAll(async () => {
    const client = await import('../src/llmClient.js');
    callLLMMock = client.callLLM;

    const module = await import('../src/services/sessionSummarizer.js');
    summarizeAndStore = module.summarizeAndStore;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldSummarize', () => {
    test('triggers on multiples of 10 messages', () => {
      expect(shouldSummarize(0)).toBe(false);
      expect(shouldSummarize(5)).toBe(false);
      expect(shouldSummarize(10)).toBe(true);
      expect(shouldSummarize(19)).toBe(false);
      expect(shouldSummarize(20)).toBe(true);
    });
  });

  describe('parseSummaryResponse', () => {
    test('parses clean JSON format', () => {
      const input = JSON.stringify({ summary: 'A nice talk', themes: ['growth', 'joy'] });
      const parsed = _internals.parseSummaryResponse(input);

      expect(parsed.summary).toBe('A nice talk');
      expect(parsed.themes).toEqual(['growth', 'joy']);
    });

    test('strips markdown fences and parses', () => {
      const input = '```json\n{\n  "summary": "A nice talk",\n  "themes": ["growth"]\n}\n```';
      const parsed = _internals.parseSummaryResponse(input);

      expect(parsed.summary).toBe('A nice talk');
      expect(parsed.themes).toEqual(['growth']);
    });

    test('gracefully falls back on parsing errors', () => {
      const parsed = _internals.parseSummaryResponse('Plain text output that is not JSON');
      expect(parsed.summary).toBe('Plain text output that is not JSON');
      expect(parsed.themes).toEqual([]);
    });
  });

  describe('buildSummarizationPrompt', () => {
    test('includes conversation history in prompt', () => {
      const text = 'User: Hi\nAssistant: Hello';
      const prompt = _internals.buildSummarizationPrompt(text);

      expect(prompt).toContain('User: Hi');
      expect(prompt).toContain('Assistant: Hello');
      expect(prompt).toContain('clinical note-taker');
    });
  });
});
