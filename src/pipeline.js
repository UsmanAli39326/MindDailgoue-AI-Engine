// ─────────────────────────────────────────────────────────────
// pipeline.js
// Orchestrates the full preprocessing pipeline:
//   sanitize → safety check → intent detect → build prompt
// Modular and extensible — supports middleware hooks.
// Pure function — no side effects, no external dependencies.
// ─────────────────────────────────────────────────────────────

import { sanitize } from './inputSanitizer.js';
import { check as safetyCheck } from './middleware/crisisScanner.js';
import { detect as detectIntent } from './intentDetector.js';
import { build as buildPrompt } from './systemPromptBuilder.js';
import { extractEntities } from './entityExtractor.js';

// ─── Middleware / Hook System ────────────────────────────────
// Allows future extensions (memory injection, context enrichment,
// analytics, logging) to be inserted without modifying core logic.
//
// Each hook receives the current pipeline context and can mutate it.
// Hooks are executed in registration order at defined stages.

/**
 * @typedef {Object} PipelineContext
 * @property {string}  rawInput
 * @property {string}  cleanedInput
 * @property {Object}  safetyResult
 * @property {Object}  intentResult
 * @property {string}  systemPrompt
 * @property {Object}  metadata — extensible bag for hooks to attach data
 */

/**
 * @typedef {"afterSanitize" | "afterSafetyCheck" | "afterIntentDetect" | "afterPromptBuild"} HookStage
 */

/**
 * @typedef {(context: PipelineContext) => PipelineContext | void} HookFunction
 */

/** @type {Map<HookStage, HookFunction[]>} */
const hooks = new Map([
  ['afterSanitize', []],
  ['afterSafetyCheck', []],
  ['afterIntentDetect', []],
  ['afterPromptBuild', []],
]);

/**
 * Register a middleware hook at a specific pipeline stage.
 *
 * @param {HookStage}    stage — when the hook should execute
 * @param {HookFunction} fn   — receives mutable pipeline context
 */
export function registerHook(stage, fn) {
  if (!hooks.has(stage)) {
    throw new Error(
      `Invalid hook stage "${stage}". Valid stages: ${[...hooks.keys()].join(', ')}`
    );
  }
  if (typeof fn !== 'function') {
    throw new Error('Hook must be a function.');
  }
  hooks.get(stage).push(fn);
}

/**
 * Remove all registered hooks (useful for testing).
 */
export function clearHooks() {
  for (const [, hookList] of hooks) {
    hookList.length = 0;
  }
}

/**
 * Execute all hooks registered at a given stage.
 * @param {HookStage}       stage
 * @param {PipelineContext}  context
 * @returns {PipelineContext}
 */
function runHooks(stage, context) {
  const hookList = hooks.get(stage) || [];
  let ctx = context;
  for (const fn of hookList) {
    const result = fn(ctx);
    if (result !== undefined) {
      ctx = result;
    }
  }
  return ctx;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} PipelineOutput
 * @property {string}                cleanedInput
 * @property {string}                detectedIntent
 * @property {"high"|"medium"|"low"} intentConfidence
 * @property {Record<string,number>} intentScores
 * @property {boolean}               isHighRisk
 * @property {"high"|"medium"|"none"} riskSeverity
 * @property {string|null}           safetyCategory
 * @property {string}                systemPrompt
 * @property {"continue"|"crisis_override"} nextStep
 * @property {Object}                metadata — extensible bag from hooks
 */

// Register the entity extractor as a default hook
registerHook('afterSanitize', (context) => {
  const entities = extractEntities(context.rawInput);
  context.metadata.entities = entities;
  return context;
});

/**
 * Process raw user input through the full preprocessing pipeline.
 *
 * Pipeline stages:
 *   1. Sanitize input
 *   2. [Hook: afterSanitize]
 *   3. Safety check → short-circuit on HIGH severity
 *   4. [Hook: afterSafetyCheck]
 *   5. Detect emotional intent
 *   6. [Hook: afterIntentDetect]
 *   7. Build system prompt (intent-adaptive)
 *   8. [Hook: afterPromptBuild]
 *   9. Return structured output contract
 *
 * @param {string} rawInput — the raw user message
 * @returns {PipelineOutput}
 */
export function processInput(rawInput) {
  // ─── Stage 1: Sanitize ───────────────────────────────────
  const sanitizeResult = sanitize(rawInput);

  if (!sanitizeResult.success) {
    return {
      cleanedInput: '',
      detectedIntent: 'calm',
      intentConfidence: 'low',
      intentScores: {},
      isHighRisk: false,
      riskSeverity: 'none',
      safetyCategory: null,
      systemPrompt: buildPrompt('calm'),
      nextStep: 'continue',
      metadata: { error: sanitizeResult.error },
    };
  }

  /** @type {PipelineContext} */
  let context = {
    rawInput,
    cleanedInput: sanitizeResult.cleanedInput,
    safetyResult: null,
    intentResult: null,
    systemPrompt: '',
    metadata: {},
  };

  // Hook: afterSanitize
  context = runHooks('afterSanitize', context);

  // ─── Stage 2: Safety Check ──────────────────────────────
  context.safetyResult = safetyCheck(context.cleanedInput);

  // Hook: afterSafetyCheck
  context = runHooks('afterSafetyCheck', context);

  // ─── Stage 3: Intent Detection ──────────────────────────
  context.intentResult = detectIntent(context.cleanedInput);

  // Hook: afterIntentDetect
  context = runHooks('afterIntentDetect', context);

  // ─── Stage 4: System Prompt Construction ────────────────
  context.systemPrompt = buildPrompt(context.intentResult.intent);
  
  if (context.safetyResult.crisisInstruction) {
    context.systemPrompt += context.safetyResult.crisisInstruction;
  }

  context.nextStep = context.safetyResult.isHighRisk ? 'crisis_override' : 'continue';

  // Hook: afterPromptBuild
  context = runHooks('afterPromptBuild', context);

  // ─── Stage 5: Assemble Output Contract ──────────────────
  return {
    cleanedInput: context.cleanedInput,
    detectedIntent: context.intentResult.intent,
    intentConfidence: context.intentResult.confidence,
    intentScores: context.intentResult.scores,
    isHighRisk: context.safetyResult.isHighRisk,
    riskSeverity: context.safetyResult.riskSeverity,
    safetyCategory: context.safetyResult.category,
    systemPrompt: context.systemPrompt,
    nextStep: context.nextStep,
    metadata: {
      ...context.metadata,
      ...(context.safetyResult.matches.length > 0
        ? { safetyMatches: context.safetyResult.matches }
        : {}),
    },
  };
}
