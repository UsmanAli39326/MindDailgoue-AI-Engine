// ─────────────────────────────────────────────────────────────
// executionPipeline.js
// Main Phase 2 orchestrator. Consumes Phase 1 output and
// produces a safe, context-aware, therapist-style response.
//
// Flow:
//   1. Crisis override check (short-circuit)
//   2. Session management + persona locking
//   3. Memory retrieval
//   4. Prompt assembly
//   5. System prompt + assembled prompt merge
//   6. LLM call
//   7. Response safety check
//   8. Post-processing
//   9. Memory storage
//  10. Return structured output
// ─────────────────────────────────────────────────────────────

import { getPersonaById } from './personaManager.js';
import {
  getOrCreateSession,
  appendMessage,
  getRecentHistory,
} from './memoryManager.js';
import { assemblePrompt } from './promptAssembler.js';
import { callLLM } from './llmClient.js';
import { checkResponseSafety } from './responseSafetyCheck.js';
import { postProcess } from './responsePostProcessor.js';

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Execute the Phase 2 pipeline: take Phase 1 output and produce
 * a safe, therapist-style response.
 *
 * @param {Object} options
 * @param {Object} options.phase1Output   — output from Phase 1's processInput()
 * @param {string} options.sessionId      — unique session identifier
 * @param {string} options.therapistId    — persona ID (locked on first call per session)
 * @param {Object} [options.llmOptions]   — optional overrides for LLM call
 * @param {string} [options.llmOptions.model]        — model name override
 * @param {number} [options.llmOptions.temperature]  — temperature override
 * @returns {Promise<{
 *   response: string,
 *   therapistId: string,
 *   detectedIntent: string,
 *   isHighRisk: boolean,
 *   responseUnsafe: boolean,
 *   metadata: {
 *     modelUsed: string,
 *     tokensUsed: number | null,
 *     wasFallback: boolean
 *   }
 * }>}
 */
export async function execute({
  phase1Output,
  sessionId,
  therapistId,
  llmOptions = {},
} = {}) {
  // ─── Validate inputs ───────────────────────────────────────
  if (!phase1Output || typeof phase1Output !== 'object') {
    throw new Error('phase1Output is required and must be an object.');
  }
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    throw new Error('sessionId must be a non-empty string.');
  }
  if (typeof therapistId !== 'string' || therapistId.trim().length === 0) {
    throw new Error('therapistId must be a non-empty string.');
  }

  // ─── Step 1: Crisis Override Check ─────────────────────────
  if (phase1Output.nextStep === 'crisis_override') {
    return {
      response: phase1Output.systemPrompt, // crisis response from Phase 1
      therapistId,
      detectedIntent: phase1Output.detectedIntent || 'neutral',
      isHighRisk: true,
      responseUnsafe: false,
      metadata: {
        modelUsed: 'none',
        tokensUsed: null,
        wasFallback: false,
      },
    };
  }

  // ─── Step 2: Session Management + Persona Locking ──────────
  // getOrCreateSession locks the persona on first call.
  // Throws if a different therapistId is passed for existing session.
  getOrCreateSession(sessionId, therapistId);

  // Validate persona exists
  const persona = getPersonaById(therapistId);

  // ─── Step 3: Retrieve Memory ───────────────────────────────
  const recentHistory = getRecentHistory(sessionId);

  // ─── Step 4: Assemble Prompt ───────────────────────────────
  const assembledPrompt = assemblePrompt({
    phase1Output,
    persona,
    recentHistory,
  });

  // ─── Step 5: Merge System Prompt + Assembled Prompt ────────
  // Ollama /api/generate expects a single prompt string.
  // Phase 1's systemPrompt provides the base therapeutic context.
  const finalPrompt = phase1Output.systemPrompt + '\n\n' + assembledPrompt;

  // ─── Step 6: Call LLM ──────────────────────────────────────
  let llmResult;
  try {
    llmResult = await callLLM({
      prompt: finalPrompt,
      model: llmOptions.model,
      temperature: llmOptions.temperature,
    });
  } catch (error) {
    // LLM failure → return a graceful fallback, not a crash.
    return {
      response:
        'I\'m here and I want to help, but I\'m having a moment of difficulty. ' +
        'Could you share that with me again? I want to make sure I give you ' +
        'the thoughtful response you deserve.',
      therapistId,
      detectedIntent: phase1Output.detectedIntent || 'neutral',
      isHighRisk: phase1Output.isHighRisk || false,
      responseUnsafe: false,
      metadata: {
        modelUsed: llmOptions.model || 'mistral',
        tokensUsed: null,
        wasFallback: true,
        error: error.message,
      },
    };
  }

  // ─── Step 7: Response Safety Check ─────────────────────────
  const safetyResult = checkResponseSafety(llmResult.text);

  // ─── Step 8: Post-Processing ───────────────────────────────
  const processed = postProcess({
    rawResponse: llmResult.text,
    safetyResult,
    seed: phase1Output.cleanedInput || '',
  });

  // ─── Step 9: Store Messages in Memory ──────────────────────
  // Store the user's original input
  if (phase1Output.cleanedInput && phase1Output.cleanedInput.trim().length > 0) {
    appendMessage(sessionId, 'user', phase1Output.cleanedInput);
  }
  // Store the assistant's response
  appendMessage(sessionId, 'assistant', processed.response);

  // ─── Step 10: Return Structured Output ─────────────────────
  return {
    response: processed.response,
    therapistId,
    detectedIntent: phase1Output.detectedIntent || 'neutral',
    isHighRisk: phase1Output.isHighRisk || false,
    responseUnsafe: !safetyResult.safe,
    metadata: {
      modelUsed: llmResult.model,
      tokensUsed: llmResult.tokensUsed,
      wasFallback: processed.wasFallback,
    },
  };
}
