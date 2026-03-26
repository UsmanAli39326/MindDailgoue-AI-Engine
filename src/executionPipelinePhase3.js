// ─────────────────────────────────────────────────────────────
// executionPipelinePhase3.js
// Orchestrates the entire system, wiring Phase 1, Phase 2,
// and Phase 3 together.
// ─────────────────────────────────────────────────────────────

import { processInput as phase1Process } from './pipeline.js';
import { getPersonaById } from './personaManager.js';
import { getOrCreateSession, appendMessage, getRecentHistory } from './memoryManager.js';
import { filterMemory } from './memoryFilter.js';
import { summarizeMemory } from './memoryCompressor.js';
import { storeMemory, retrieveRelevantMemories } from './vectorMemoryManager.js';
import { getProfile, updateProfile } from './userProfileManager.js';
import { buildMemoryContext, buildProfileContext } from './contextBuilder.js';
import { getAdaptiveInstructions } from './adaptiveResponseController.js';
import { assembleEnhancedPrompt } from './enhancedPromptAssembler.js';
import { callLLM } from './llmClient.js';
import { checkResponseSafety } from './responseSafetyCheck.js';
import { postProcess } from './responsePostProcessor.js';

export async function executePhase3({ sessionId, therapistId, input }) {
  // 1. PHASE 1: Run Input processing
  const phase1Output = processInputSafely(input);

  // Load Phase 2 persona and session memory (short term)
  const persona = getPersonaById(therapistId);
  getOrCreateSession(sessionId, therapistId);

  appendMessage(sessionId, 'user', phase1Output.cleanedInput || input);
  const recentHistory = getRecentHistory(sessionId);

  // 2. High-Risk Short Circuit
  if (phase1Output.nextStep === 'crisis_override' || phase1Output.isHighRisk) {
    const rawResponse = phase1Output.systemPrompt;
    appendMessage(sessionId, 'assistant', rawResponse);
    return buildOutput(rawResponse, false, phase1Output, persona, 0, false, { modelUsed: 'none' });
  }

  // 3. Retrieve highly relevant past memories (top 2) using current input
  let relevantMemories = [];
  try {
    relevantMemories = await retrieveRelevantMemories(sessionId, phase1Output.cleanedInput, 2);
  } catch (err) {
    console.warn('Memory retrieval failed this turn:', err.message);
  }

  // 4. PHASE 3: Memory Routing & Long-Term Storage
  const { shouldStore, importance } = filterMemory(
    phase1Output.cleanedInput,
    phase1Output.detectedIntent,
    phase1Output.isHighRisk
  );

  if (shouldStore) {
    try {
      // CONSTRAINT 6: Token compression before storing to vector db
      const summary = await summarizeMemory(phase1Output.cleanedInput);
      await storeMemory(sessionId, summary, { importance, intent: phase1Output.detectedIntent });
    } catch (err) {
      console.warn('Memory storage failed this turn:', err.message);
    }
  }

  // 5. User Profile loading
  const userProfile = getProfile(sessionId);

  // 6. Context Building
  const memoryContext = buildMemoryContext(relevantMemories);
  const profileContext = buildProfileContext(userProfile);
  const adaptiveInstructions = getAdaptiveInstructions(userProfile);

  // 7. Assemble final Phase 3 Prompt
  const prompt = assembleEnhancedPrompt({
    phase1Output,
    persona,
    recentHistory,
    memoryContext,
    profileContext,
    adaptiveInstructions
  });

  // 8. Call LLM
  let llmOutput;
  let wasFallback = false;
  let errorMsg = null;
  try {
    llmOutput = await callLLM({ prompt, temperature: 0.7 }); // Phase 2 default
  } catch (err) {
    console.error('LLM Call Failed:', err.message);
    wasFallback = true;
    errorMsg = err.message;
    llmOutput = {
      text: 'I\'m here and I want to help, but I\'m having a moment of difficulty. Could you share that with me again? I want to make sure I give you the thoughtful response you deserve.',
      model: 'none'
    };
  }

  // 9. Post-Process & Safety Check
  const safetyResult = checkResponseSafety(llmOutput.text);
  const processed = postProcess({
    rawResponse: llmOutput.text,
    safetyResult,
    seed: sessionId // use sessionId for fallback determinism
  });

  if (processed.wasFallback) wasFallback = true;
  const finalResponse = processed.response;

  // 10. Update Profile (incremental drift prevention)
  let profileUpdated = false;
  if (!wasFallback) {
    updateProfile(sessionId, { 
      intent: phase1Output.detectedIntent,
      entities: phase1Output.metadata.entities 
    });
    profileUpdated = true;
  }

  // Append safe response to short-term history
  appendMessage(sessionId, 'assistant', finalResponse);

  return buildOutput(
    finalResponse,
    !safetyResult.safe,
    phase1Output,
    persona,
    relevantMemories.length,
    profileUpdated,
    {
      modelUsed: llmOutput.model,
      wasFallback,
      error: errorMsg,
      promptTokens: llmOutput.tokensUsed, // mock
    }
  );
}

// Wrapper to prevent Phase 1 throwing uncaught
function processInputSafely(input) {
  try {
    return phase1Process(input);
  } catch (err) {
    return {
      cleanedInput: typeof input === 'string' ? input.trim() : '',
      detectedIntent: 'neutral',
      intentConfidence: 'low',
      isHighRisk: false,
      nextStep: 'continue',
      systemPrompt: 'Follow Phase 2 instructions.'
    };
  }
}

function buildOutput(response, unsafe, p1, persona, memoriesUsed, profileUpdated, meta = {}) {
  return {
    response,
    therapistId: persona.id,
    detectedIntent: p1.detectedIntent || 'neutral',
    relevantMemoriesUsed: memoriesUsed,
    profileUpdated,
    isHighRisk: !!p1.isHighRisk,
    responseUnsafe: unsafe,
    metadata: meta
  };
}
