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
import { isUserInCooldown, handleCrisis } from './middleware/crisisHandler.js';
import { logMood } from './services/moodService.js';
import { getSessionContext } from './services/memoryContext.js';
import { shouldSummarize, summarizeAndStore } from './services/sessionSummarizer.js';
import { updateThemes } from './services/themeTracker.js';
import { recordActivity } from './services/streakService.js';
import { storeEncryptedMessage } from './services/encryptedStorage.js';
import { getUserBasicInfo, updateLastActive } from './services/userService.js';
import { EncryptionService } from './services/encryptionService.js';

export async function executePhase3({ sessionId, therapistId, input, uid }) {
  // 0. Cooldown check
  if (isUserInCooldown(uid)) {
    return {
      message: "I care about you, and I want to make sure we're approaching this safely. Let's take a brief moment to breathe.",
      emotion: "calm",
      intensity: 0.5,
      stress_level: 0.5,
      crisis: false,
      suggestions: [],
      mood_tag: "cooldown",
      crisis_mode: true,
      error: "429 Too Many Requests"
    };
  }

  // 1. PHASE 1: Run Input processing
  const phase1Output = processInputSafely(input);

  // Load Phase 2 persona and session memory (short term)
  const persona = await getPersonaById(therapistId, uid);
  await getOrCreateSession(uid, sessionId, therapistId);

  await appendMessage(uid, sessionId, 'user', phase1Output.cleanedInput || input);

  if (uid) {
    const userEncrypted = EncryptionService.encrypt(phase1Output.cleanedInput || input);
    storeEncryptedMessage(uid, {
      ciphertext: userEncrypted.ciphertext,
      iv: userEncrypted.iv,
      sessionId,
      role: 'user'
    }).catch(err => console.error('[DB PERSISTENCE] User message fail:', err.message));
  }

  const recentHistory = await getRecentHistory(uid, sessionId);

  // 2. High-Risk Short Circuit
  if (phase1Output.nextStep === 'crisis_override') {
    const fallbackResponse = {
      message: "I hear you, and I want you to know that you are not alone. Please reach out to a professional or someone you trust who can support you right now. Your safety is the absolute priority.",
      emotion: "calm",
      intensity: 0.9,
      stress_level: 0.9,
      crisis: true,
      suggestions: ["Call 988", "Text HOME to 741741"],
      mood_tag: "crisis_override"
    };

    const augmented = await handleCrisis(fallbackResponse, {
      uid,
      sessionId,
      scannerCategory: phase1Output.safetyCategory,
      isHighRisk: true
    });

    await appendMessage(uid, sessionId, 'assistant', augmented.message);

    if (uid) {
      const crisisEncrypted = EncryptionService.encrypt(augmented.message || augmented);
      storeEncryptedMessage(uid, {
        ciphertext: crisisEncrypted.ciphertext,
        iv: crisisEncrypted.iv,
        sessionId,
        role: 'assistant'
      }).catch(err => console.error('[DB PERSISTENCE] Assistant crisis override fail:', err.message));
    }

    return buildOutput(augmented, false, phase1Output, persona, 0, false, { modelUsed: 'none' });
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
  const userProfile = getProfile(uid);

  // 6. Context Building
  let crossSessionContext = '';
  let userBasicInfo = null;
  try {
    if (uid) {
      const [context, basicInfo] = await Promise.all([
        getSessionContext(uid),
        getUserBasicInfo(uid)
      ]);
      crossSessionContext = context;
      userBasicInfo = basicInfo;
    }
  } catch (err) {
    console.warn('Context fetch failed:', err.message);
  }
  const memoryContext = buildMemoryContext(relevantMemories, crossSessionContext);
  const profileContext = buildProfileContext(userProfile, userBasicInfo);
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
    llmOutput = await callLLM({ prompt, temperature: 0.78 }); // Set to 0.78 for natural, non-robotic flow
  } catch (err) {
    console.error('LLM Call Failed:', err.message);
    wasFallback = true;
    errorMsg = err.message;

    if (phase1Output.isHighRisk) {
      llmOutput = {
        text: JSON.stringify({
          message: 'I hear you, and I want you to know that you are not alone. Please reach out to someone who can help you right now. Your safety and well-being are incredibly important.',
          emotion: 'calm',
          intensity: 0.9,
          stress_level: 0.9,
          crisis: true,
          suggestions: ['Call 988', 'Text HOME to 741741'],
          mood_tag: 'crisis_fallback'
        }),
        model: 'none'
      };
    } else {
      llmOutput = {
        text: 'I\'m here and I want to help, but I\'m having a moment of difficulty. Could you share that with me again? I want to make sure I give you the thoughtful response you deserve.',
        model: 'none'
      };
    }
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
    updateProfile(uid, {
      intent: phase1Output.detectedIntent,
      entities: phase1Output.metadata.entities
    });
    profileUpdated = true;
  }

  // 11. Crisis Handling (Phase 2A)
  const augmentedResponse = await handleCrisis(finalResponse, {
    uid,
    sessionId,
    scannerCategory: phase1Output.safetyCategory,
    isHighRisk: phase1Output.isHighRisk
  });

  // 12. Mood Auto-Logging (Phase 3A — fire-and-forget)
  logMood(uid, sessionId, augmentedResponse);

  // Append safe response to short-term history
  await appendMessage(uid, sessionId, 'assistant', augmentedResponse.message || augmentedResponse);

  if (uid) {
    const assistantEncrypted = EncryptionService.encrypt(augmentedResponse.message || augmentedResponse);
    storeEncryptedMessage(uid, {
      ciphertext: assistantEncrypted.ciphertext,
      iv: assistantEncrypted.iv,
      sessionId,
      role: 'assistant'
    }).catch(err => console.error('[DB PERSISTENCE] Assistant message fail:', err.message));
    
    // Update last active timestamp for check-in push notifications
    updateLastActive(uid);
  }

  // 13. Auto-Summarization, Streak, & Theme Tracking (Phase 4A, 4D & 5A — fire-and-forget)
  if (uid) {
    try {
      recordActivity(uid);
      const currentHistory = await getRecentHistory(uid, sessionId);
      const historyLines = currentHistory ? currentHistory.split('\n').filter(Boolean) : [];
      if (shouldSummarize(historyLines.length)) {
        summarizeAndStore(uid, sessionId, historyLines).then(summary => {
          if (summary && summary.themes && summary.themes.length > 0) {
            updateThemes(uid, summary.themes);
          }
        }).catch(err => {
          console.error('[AUTO-SUMMARIZER] Error storing summary:', err.message);
        });
      }
    } catch (err) {
      console.warn('[AUTO-SUMMARIZER] Trigger check failed:', err.message);
    }
  }

  return buildOutput(
    augmentedResponse,
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
      detectedIntent: 'calm',
      intentConfidence: 'low',
      isHighRisk: false,
      nextStep: 'continue',
      systemPrompt: 'Follow Phase 2 instructions.'
    };
  }
}

function buildOutput(envelope, unsafe, p1, persona, memoriesUsed, profileUpdated, meta = {}) {
  // If envelope is still a string (fallback case from earlier phases), wrap it
  const responseEnvelope = typeof envelope === 'string' ? {
    message: envelope,
    emotion: "calm",
    intensity: 0.5,
    stress_level: 0.3,
    crisis: false,
    suggestions: [],
    mood_tag: "fallback_legacy"
  } : { ...envelope };

  // Dynamic Heuristic Refinement for fallback classifications (e.g. when LLM outputs plain text instead of JSON)
  if (meta.wasFallback || responseEnvelope.mood_tag === 'fallback' || responseEnvelope.mood_tag === 'fallback_legacy') {
    let intent = p1.detectedIntent || 'calm';
    if (intent === 'hopeful') intent = 'happy';
    else if (intent === 'angry') intent = 'stressed';
    else if (intent === 'confused' || intent === 'neutral') intent = 'calm';

    responseEnvelope.emotion = intent;
    responseEnvelope.mood_tag = 'fallback_heuristics';

    // Map intent detector confidence to emotion intensity
    const confidenceIntensity = {
      high: 0.85,
      medium: 0.65,
      low: 0.45
    };
    responseEnvelope.intensity = confidenceIntensity[p1.intentConfidence] || 0.5;

    // Formulate stress level based on intent and confidence
    const highStressIntents = ['stressed', 'anxious', 'sad'];
    if (highStressIntents.includes(intent)) {
      responseEnvelope.stress_level = p1.intentConfidence === 'high' ? 0.8 : (p1.intentConfidence === 'medium' ? 0.6 : 0.4);
    } else if (intent === 'happy') {
      responseEnvelope.stress_level = 0.15;
    } else {
      responseEnvelope.stress_level = 0.25;
    }
  }

  let finalIntent = p1.detectedIntent || 'calm';
  if (finalIntent === 'hopeful') finalIntent = 'happy';
  else if (finalIntent === 'angry') finalIntent = 'stressed';
  else if (finalIntent === 'confused' || finalIntent === 'neutral') finalIntent = 'calm';

  return {
    ...responseEnvelope,
    therapistId: persona.id,
    detectedIntent: finalIntent,
    relevantMemoriesUsed: memoriesUsed,
    profileUpdated,
    isHighRisk: !!p1.isHighRisk,
    responseUnsafe: unsafe,
    metadata: meta
  };
}
