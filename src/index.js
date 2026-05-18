// ─────────────────────────────────────────────────────────────
// index.js
// Public entry point for the AI Preprocessing Module.
// Re-exports the pipeline and all sub-modules for granular use.
// ─────────────────────────────────────────────────────────────

// Main pipeline — the primary public API
export { processInput, registerHook, clearHooks } from './pipeline.js';
export { execute as executePipeline } from './executionPipeline.js';

// Individual modules — for granular / advanced usage
export { sanitize } from './inputSanitizer.js';
export { detect as detectIntent } from './intentDetector.js';
export { check as checkSafety } from './middleware/crisisScanner.js';
export { build as buildSystemPrompt, getAvailableIntents } from './systemPromptBuilder.js';

// Phase 2 Modules
export { callLLM } from './llmClient.js';
export { getPersonaById, listPersonas } from './personaManager.js';
export { getOrCreateSession, appendMessage, getRecentHistory, resetSession, clearAll as clearMemory } from './memoryManager.js';
export { assemblePrompt } from './promptAssembler.js';
export { checkResponseSafety } from './responseSafetyCheck.js';
export { postProcess as postProcessResponse } from './responsePostProcessor.js';

// Phase 3 Modules
export * as vectorMemoryManager from './vectorMemoryManager.js';
export * as memoryFilter from './memoryFilter.js';
export * as userProfileManager from './userProfileManager.js';
export * as memoryCompressor from './memoryCompressor.js';
export * as contextBuilder from './contextBuilder.js';
export * as adaptiveResponseController from './adaptiveResponseController.js';
export * as enhancedPromptAssembler from './enhancedPromptAssembler.js';
export * as executionPipelinePhase3 from './executionPipelinePhase3.js';
