// ─────────────────────────────────────────────────────────────
// llmClient.js
// Connects to OpenRouter API (OpenAI-compatible) to execute
// LLM inference. Non-streaming, single-prompt mode.
// ─────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ override: true });
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local', override: true });
}

// ─── Configuration ──────────────────────────────────────────

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama3-8b-8192';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const DEFAULT_TEMPERATURE = 0.7;
const REQUEST_TIMEOUT_MS = 120_000;

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
const OLLAMA_API_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat';
const OLLAMA_DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

export async function callLLM({
  prompt,
  model,
  temperature = DEFAULT_TEMPERATURE,
} = {}) {
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new Error('Prompt must be a non-empty string.');
  }

  const useHosted = process.env.USE_HOSTED_AI === 'true';
  const targetModel = model || (useHosted ? DEFAULT_MODEL : OLLAMA_DEFAULT_MODEL);
  const timeoutMs = useHosted ? 15_000 : (parseInt(process.env.LLM_TIMEOUT_MS) || REQUEST_TIMEOUT_MS);

  if (useHosted) {
    // Hosted Groq Flow
    if (!GROQ_API_KEY || GROQ_API_KEY === 'your_groq_key_here') {
      throw new Error('Groq API key is missing. Please set GROQ_API_KEY in .env.local.');
    }

    const requestBody = {
      model: targetModel,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature,
      stop: ['[THERAPIST IDENTITY]', '[PERSONALITY]', '[USER EMOTIONAL STATE]', '[SAFETY CONTEXT]', '[CONVERSATION HISTORY]', '[CURRENT INPUT]', '[INSTRUCTIONS]', '[RESPONSE]', 'User:', '👤 User:']
    };

    let response;
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'ai_call',
        model: targetModel,
        status: 'failed',
        error: error.message,
        latency_ms: durationMs,
      }));

      if (error.name === 'AbortError') {
        throw new Error(
          `Groq request timed out after ${timeoutMs / 1000}s.`
        );
      }
      throw new Error(
        `Failed to connect to Groq at ${GROQ_API_URL}. Original error: ${error.message}`
      );
    }

    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      const errorMessage = errorData.error?.message || 'Groq returned non-OK status';

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'ai_call',
        model: targetModel,
        status: 'http_error',
        statusCode: response.status,
        latency_ms: durationMs,
      }));

      throw new Error(
        `Groq returned HTTP ${response.status}: ${errorMessage}`
      );
    }

    const data = await response.json();
    const tokens_in = data.usage?.prompt_tokens || 0;
    const tokens_out = data.usage?.completion_tokens || 0;

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      type: 'ai_call',
      model: data.model || targetModel,
      status: 'success',
      tokens_in,
      tokens_out,
      latency_ms: durationMs,
    }));

    return {
      text: data.choices?.[0]?.message?.content || '',
      model: data.model || targetModel,
      totalDuration: durationMs,
      tokensUsed: data.usage?.total_tokens || null,
    };
  } else {
    // Local Ollama Flow
    const requestBody = {
      model: targetModel,
      messages: [
        { role: 'user', content: prompt }
      ],
      stream: false,
      options: {
        temperature
      }
    };

    let response;
    const startTime = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      response = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'ai_call',
        model: targetModel,
        status: 'failed',
        error: error.message,
        latency_ms: durationMs,
      }));

      if (error.name === 'AbortError') {
        throw new Error(
          `Local Ollama request timed out after ${timeoutMs / 1000}s.`
        );
      }
      throw new Error(
        `Failed to connect to local Ollama at ${OLLAMA_API_URL}. Original error: ${error.message}`
      );
    }

    const durationMs = Math.round(performance.now() - startTime);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'ai_call',
        model: targetModel,
        status: 'http_error',
        statusCode: response.status,
        latency_ms: durationMs,
      }));

      throw new Error(
        `Local Ollama returned HTTP ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();
    return {
      text: data.message?.content || '',
      model: data.model || targetModel,
      totalDuration: durationMs,
      tokensUsed: null,
    };
  }
}

// Export internals for testing / configuration override
export const _internals = {
  GROQ_API_URL,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  REQUEST_TIMEOUT_MS,
};

