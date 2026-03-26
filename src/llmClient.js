// ─────────────────────────────────────────────────────────────
// llmClient.js
// Connects to OpenRouter API (OpenAI-compatible) to execute
// LLM inference. Non-streaming, single-prompt mode.
// ─────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

// ─── Configuration ──────────────────────────────────────────

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-2-9b-it:free';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

const DEFAULT_TEMPERATURE = 0.7;
const REQUEST_TIMEOUT_MS = 120_000; // 2 minutes

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Call the OpenRouter LLM using the chat completions endpoint.
 *
 * @param {Object} options
 * @param {string} options.prompt       — the full merged prompt string
 * @param {string} [options.model]      — OpenRouter model name (default: google/gemma-2-9b-it:free)
 * @param {number} [options.temperature] — generation temperature (default: 0.7)
 * @returns {Promise<{
 *   text: string,
 *   model: string,
 *   totalDuration: number | null,
 *   tokensUsed: number | null
 * }>}
 * @throws {Error} on connection failure or non-OK response
 */
export async function callLLM({
  prompt,
  model = DEFAULT_MODEL,
  temperature = DEFAULT_TEMPERATURE,
} = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt must be a non-empty string.');
  }

  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'your_openrouter_key_here') {
    throw new Error('OpenRouter API key is missing. Please set OPENROUTER_API_KEY in .env.local.');
  }

  const requestBody = {
    model,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature,
    stop: ['[THERAPIST IDENTITY]', '[PERSONALITY]', '[USER EMOTIONAL STATE]', '[SAFETY CONTEXT]', '[CONVERSATION HISTORY]', '[CURRENT INPUT]', '[INSTRUCTIONS]', '[RESPONSE]', 'User:', '👤 User:']
  };

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://github.com/google/antigravity', // Optional site URL
        'X-Title': 'MindDialogue LLM Assistant', // Optional site title
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(
        `OpenRouter request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
      );
    }
    throw new Error(
      `Failed to connect to OpenRouter at ${OPENROUTER_API_URL}. Original error: ${error.message}`
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const errorMessage = errorData.error?.message || 'OpenRouter returned non-OK status';
    throw new Error(
      `OpenRouter returned HTTP ${response.status}: ${errorMessage}`
    );
  }

  const data = await response.json();

  return {
    text: data.choices?.[0]?.message?.content || '',
    model: data.model || model,
    totalDuration: null, // OpenRouter doesn't return total duration in same format
    tokensUsed: data.usage?.total_tokens || null,
  };
}

// Export internals for testing / configuration override
export const _internals = {
  OPENROUTER_API_URL,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  REQUEST_TIMEOUT_MS,
};

