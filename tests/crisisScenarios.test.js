// ─────────────────────────────────────────────────────────────
// crisisScenarios.test.js
// End-to-end crisis management scenario tests.
// Tests the full flow from user input → scanner → pipeline → handler
// to verify what actually happens in serious crisis situations.
// ─────────────────────────────────────────────────────────────
import { jest } from '@jest/globals';

// ── Mock Firebase before anything else ──────────────────────
jest.unstable_mockModule('../src/config/firebase.js', () => {
  const mockDoctorDocs = [
    {
      data: () => ({
        name: "Dr. Sarah Jenkins, Psy.D.",
        phone: "+1-800-555-0144",
        clinicUrl: "https://yourclinic.com/sarah-jenkins",
        specialties: ["suicide", "self_harm"],
        role: "Crisis Intervention Specialist"
      })
    }
  ];

  const mockDb = {
    collection: (colName) => ({
      where: (field, operator, value) => ({
        limit: (n) => ({
          get: async () => {
            if (colName === 'clinical_doctors' && field === 'specialties' && operator === 'array-contains') {
              return { empty: false, docs: mockDoctorDocs };
            }
            return { empty: true, docs: [] };
          }
        })
      }),
      doc: (docId) => ({
        collection: () => ({
          add: jest.fn().mockResolvedValue({ id: 'mock-event-id' })
        }),
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: 'active', messageCount: 0, therapistId: 'compassionate-listener', messages: [] })
        }),
        set: jest.fn().mockResolvedValue(),
        update: jest.fn().mockResolvedValue()
      })
    })
  };

  return {
    default: {
      firestore: () => mockDb
    },
    db: mockDb
  };
});

jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn()
}));

jest.unstable_mockModule('../src/personaManager.js', () => ({
  getPersonaById: jest.fn().mockResolvedValue({
    id: 'compassionate-listener',
    name: 'Dr. Amara',
    style: 'Warm, empathetic',
    tone: 'Gentle and supportive',
    personalityPrompt: 'You are Dr. Amara, a compassionate listener.',
    initialMessage: 'Hello, I\'m here for you.'
  }),
  listPersonas: jest.fn().mockResolvedValue([])
}));

jest.unstable_mockModule('../src/vectorMemoryManager.js', () => ({
  storeMemory: jest.fn(),
  retrieveRelevantMemories: jest.fn().mockResolvedValue([]),
  clearAll: jest.fn()
}));

jest.unstable_mockModule('../src/services/moodService.js', () => ({
  logMood: jest.fn()
}));

jest.unstable_mockModule('../src/services/memoryContext.js', () => ({
  getSessionContext: jest.fn().mockResolvedValue('')
}));

jest.unstable_mockModule('../src/services/sessionSummarizer.js', () => ({
  shouldSummarize: jest.fn().mockReturnValue(false),
  summarizeAndStore: jest.fn().mockResolvedValue(null)
}));

jest.unstable_mockModule('../src/services/themeTracker.js', () => ({
  updateThemes: jest.fn()
}));

jest.unstable_mockModule('../src/services/streakService.js', () => ({
  recordActivity: jest.fn()
}));

jest.unstable_mockModule('../src/services/encryptedStorage.js', () => ({
  storeEncryptedMessage: jest.fn().mockResolvedValue()
}));

// ─── Import modules after mocks ────────────────────────────
const { check } = await import('../src/middleware/crisisScanner.js');
const { processInput, registerHook, clearHooks } = await import('../src/pipeline.js');
const { handleCrisis, isUserInCooldown } = await import('../src/middleware/crisisHandler.js');
const { CRISIS_RESOURCES } = await import('../src/config/crisisResources.js');
const { callLLM } = await import('../src/llmClient.js');
const { executePhase3 } = await import('../src/executionPipelinePhase3.js');

// ─────────────────────────────────────────────────────────────
// SCENARIO 1: Scanner Detection Coverage
// ─────────────────────────────────────────────────────────────
describe('SCENARIO 1: Crisis Scanner — Detection Coverage', () => {

  describe('High-risk phrases that SHOULD trigger crisis mode', () => {
    const highRiskInputs = [
      { input: 'I want to kill myself', expectedCategory: 'suicide' },
      { input: 'I\'m going to end it tonight', expectedCategory: 'suicide' },
      { input: 'I want to die', expectedCategory: 'suicide' },
      { input: 'I\'ve been cutting myself', expectedCategory: 'self_harm' },
      { input: 'I am being abused at home', expectedCategory: 'abuse' },
      { input: 'I was sexually assaulted', expectedCategory: 'abuse' },
      { input: 'I want to hurt someone', expectedCategory: 'violence' },
      { input: 'i actually want to k*ll my self', expectedCategory: 'suicide' },
      { input: 'i wanna k1ll myself', expectedCategory: 'suicide' },
    ];

    test.each(highRiskInputs)('detects "$input" as HIGH risk ($expectedCategory)', ({ input, expectedCategory }) => {
      const result = check(input);
      expect(result.isHighRisk).toBe(true);
      expect(result.riskSeverity).toBe('high');
      expect(result.category).toBe(expectedCategory);
      expect(result.crisisInstruction).toBeTruthy();
    });
  });

  describe('Realistic crisis messages that MAY be MISSED (evasion test)', () => {
    const evasionInputs = [
      'i wanna kms',                          // slang
      'i wanna kill myself',                   // "wanna" vs "want to"
      'im gonna end it all tonight',           // "im gonna" vs "i will"
      'i dont want to be here anymore',        // indirect
      'thinking about jumping off a bridge',   // method-specific
      'i took all my pills',                   // overdose indicator
      'nobody will miss me when im gone',      // indirect
      'ive written my goodbye letter',         // suicide planning
      'i have a plan to end things',           // vague planning
      'كل شيء لا فائدة منه',                   // non-English (Arabic: "everything is pointless")
    ];

    test.each(evasionInputs)('tests whether "%s" is detected', (input) => {
      const result = check(input);
      // Just record the result — not asserting pass/fail,
      // this shows the detection gaps
      console.log(`  Input: "${input}"`);
      console.log(`    → Detected: ${result.isHighRisk ? 'HIGH' : result.riskSeverity === 'medium' ? 'MEDIUM' : 'MISSED'}`);
      console.log(`    → Category: ${result.category || 'none'}`);

      // This test always passes — it's diagnostic
      expect(true).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// SCENARIO 2: Pipeline Output for Crisis Input
// ─────────────────────────────────────────────────────────────
describe('SCENARIO 2: Phase 1 Pipeline — Crisis Flow', () => {

  test('HIGH risk input gets crisis instruction AND nextStep is "crisis_override"', () => {
    const result = processInput('I want to kill myself');

    expect(result.isHighRisk).toBe(true);
    expect(result.riskSeverity).toBe('high');
    expect(result.safetyCategory).toBe('suicide');

    // Safety override is successfully triggered
    expect(result.nextStep).toBe('crisis_override');

    // The crisis instruction IS appended to the system prompt
    expect(result.systemPrompt).toContain('URGENT CRISIS EVALUATION');

    console.log('\n  ✅ SAFETY OVERRIDE ACTIVE: nextStep is "crisis_override" for high-risk input');
  });

  test('MEDIUM risk input gets gentle supportive instruction', () => {
    const result = processInput('I just feel like disappearing sometimes');

    expect(result.isHighRisk).toBe(false);
    expect(result.riskSeverity).toBe('medium');
    expect(result.safetyCategory).toBe('suicide');

    // Medium risk gets gentle instruction rather than URGENT evaluation
    expect(result.systemPrompt).toContain('GENTLE SUPPORTIVE INQUIRY');
    expect(result.systemPrompt).not.toContain('URGENT CRISIS EVALUATION');
    expect(result.nextStep).toBe('continue');

    console.log('\n  ✅ DISTRESS ASSIST ACTIVE: Medium risk gets gentle supportive prompts');
  });

  test('safe input gets no crisis handling (correct behavior)', () => {
    const result = processInput('I had a great day today!');

    expect(result.isHighRisk).toBe(false);
    expect(result.riskSeverity).toBe('none');
    expect(result.safetyCategory).toBeNull();
    expect(result.nextStep).toBe('continue');
  });
});

// ─────────────────────────────────────────────────────────────
// SCENARIO 3: Post-AI Crisis Handler
// ─────────────────────────────────────────────────────────────
describe('SCENARIO 3: Crisis Handler — Post-AI Processing', () => {

  test('LLM returns crisis:true → resources ARE attached', async () => {
    const envelope = {
      message: 'I hear you and I\'m deeply concerned about your safety...',
      emotion: 'calm',
      intensity: 0.9,
      stress_level: 0.9,
      crisis: true,
      suggestions: ['Please call 988'],
      mood_tag: 'crisis'
    };

    const result = await handleCrisis(envelope, {
      uid: 'test-user-1',
      sessionId: 'test-session-1',
      scannerCategory: 'suicide'
    });

    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.resources.length).toBeGreaterThan(1);
    expect(result.resources[0].name).toContain('SPECIALIST ON CALL');
    expect(result.resources[1].name).toContain('Suicide');

    console.log('\n  ✅ LLM crisis:true → Resources and Specialist attached correctly');
    console.log(`     Resources: ${result.resources.map(r => r.name).join(', ')}`);
  });

  test('LLM returns crisis:false BUT scanner detected HIGH risk → resources ARE attached (override)', async () => {
    const envelope = {
      message: 'I understand you\'re going through a difficult time...',
      emotion: 'calm',
      intensity: 0.5,
      stress_level: 0.5,
      crisis: false,  // LLM decided it's NOT a crisis
      suggestions: [],
      mood_tag: 'empathetic'
    };

    const result = await handleCrisis(envelope, {
      uid: 'test-user-2',
      sessionId: 'test-session-2',
      scannerCategory: 'suicide',
      isHighRisk: true // Scanner override!
    });

    expect(result.crisis).toBe(true);
    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.resources.length).toBeGreaterThan(0);

    console.log('\n  ✅ CRISIS OVERRIDE SUCCESS: Resources attached despite LLM misjudgment');
  });

  test('resources are category-specific and include specialized doctor on call', async () => {
    const categories = ['suicide', 'self_harm', 'abuse', 'violence'];

    for (const category of categories) {
      const result = await handleCrisis(
        { message: 'test', crisis: true },
        { uid: `user-${category}`, sessionId: `session-${category}`, scannerCategory: category }
      );

      expect(result.resources[0].name).toContain('SPECIALIST ON CALL');
      expect(result.resources[0].specialty).toBe(category);
      expect(result.resources.slice(1)).toEqual(CRISIS_RESOURCES[category]);
      console.log(`  ✅ ${category}: ${result.resources.map(r => r.name).join(', ')}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// SCENARIO 4: Cooldown System
// ─────────────────────────────────────────────────────────────
describe('SCENARIO 4: Cooldown System', () => {

  test('user NOT in cooldown initially', () => {
    expect(isUserInCooldown('fresh-user')).toBe(false);
  });

  test('after crisis trigger, cooldown blocks next message', async () => {
    // Trigger a crisis to set cooldown
    await handleCrisis(
      { message: 'test', crisis: true },
      { uid: 'cooldown-test-user', sessionId: 'cooldown-session', scannerCategory: 'suicide' }
    );

    // Now user should be in cooldown
    expect(isUserInCooldown('cooldown-test-user')).toBe(true);
    console.log('\n  ✅ Cooldown activates after crisis trigger');
  });
});

// ─────────────────────────────────────────────────────────────
// SCENARIO 5: Full Pipeline — Serious Crisis Message
// ─────────────────────────────────────────────────────────────
describe('SCENARIO 5: Full Phase 3 Pipeline — "I want to kill myself"', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearHooks();
  });

  test('when input is high-risk → pipeline short-circuits and bypasses LLM completely', async () => {
    const result = await executePhase3({
      sessionId: 'crisis-session-short',
      therapistId: 'compassionate-listener',
      input: 'I want to kill myself',
      uid: 'crisis-user-short'
    });

    expect(callLLM).not.toHaveBeenCalled();
    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.isHighRisk).toBe(true);
    expect(result.message).toContain('Your safety is the absolute priority');

    console.log('\n  ✅ SHORT-CIRCUIT SUCCESS: Bypassed LLM completely for high-risk input');
  });

  test('when LLM correctly returns crisis:true for medium-risk input → full crisis flow works', async () => {
    callLLM.mockResolvedValueOnce({
      text: JSON.stringify({
        message: 'I hear you, and I\'m deeply concerned about your safety right now. Your life matters. Please reach out to the 988 Suicide and Crisis Lifeline immediately.',
        emotion: 'calm',
        intensity: 0.9,
        stress_level: 0.95,
        crisis: true,
        suggestions: ['Call 988 now', 'Text HOME to 741741'],
        mood_tag: 'crisis_active'
      }),
      model: 'mistral',
      tokensUsed: 150
    });

    const result = await executePhase3({
      sessionId: 'crisis-session-good',
      therapistId: 'compassionate-listener',
      input: 'I feel like disappearing sometimes',
      uid: 'crisis-user-good'
    });

    console.log('\n  Full pipeline result (LLM crisis:true):');
    console.log(`    message: "${(result.message || '').substring(0, 80)}..."`);
    console.log(`    crisis_mode: ${result.crisis_mode}`);
    console.log(`    resources: ${result.resources ? result.resources.map(r => r.name).join(', ') : 'NONE'}`);
    console.log(`    isHighRisk: ${result.isHighRisk}`);

    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.isHighRisk).toBe(false);
  });

  test('when LLM returns crisis:false (MISJUDGMENT) during scanner high-risk (LLM called) → override attaches crisis resources', async () => {
    registerHook('afterPromptBuild', (ctx) => {
      return { ...ctx, nextStep: 'continue' };
    });

    callLLM.mockResolvedValueOnce({
      text: JSON.stringify({
        message: 'It sounds like you\'re having a really tough time. Let\'s talk about what\'s been going on.',
        emotion: 'calm',
        intensity: 0.5,
        stress_level: 0.5,
        crisis: false,  // LLM MISJUDGED
        suggestions: ['Take a walk', 'Journal your feelings'],
        mood_tag: 'empathetic'
      }),
      model: 'mistral',
      tokensUsed: 100
    });

    const result = await executePhase3({
      sessionId: 'crisis-session-bad',
      therapistId: 'compassionate-listener',
      input: 'I want to kill myself',
      uid: 'crisis-user-bad'
    });

    console.log('\n  Full pipeline result (LLM crisis:false override test):');
    console.log(`    message: "${(result.message || '').substring(0, 80)}..."`);
    console.log(`    crisis_mode: ${result.crisis_mode}`);
    console.log(`    resources: ${result.resources ? result.resources.map(r => r.name).join(', ') : 'NONE ⚠️'}`);
    console.log(`    isHighRisk: ${result.isHighRisk}`);

    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();
    expect(result.isHighRisk).toBe(true);

    console.log('\n  ✅ CRISIS OVERRIDE SUCCESS: Resources successfully attached despite LLM misjudgment');
  });

  test('when LLM CRASHES during scanner high-risk (LLM called) → user gets crisis fallback with resources', async () => {
    registerHook('afterPromptBuild', (ctx) => {
      return { ...ctx, nextStep: 'continue' };
    });

    // LLM is down
    callLLM.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await executePhase3({
      sessionId: 'crisis-session-crash',
      therapistId: 'compassionate-listener',
      input: 'I want to kill myself',
      uid: 'crisis-user-crash'
    });

    console.log('\n  Full pipeline result (LLM CRASHED crisis override test):');
    console.log(`    message: "${(result.message || '').substring(0, 80)}..."`);
    console.log(`    crisis_mode: ${result.crisis_mode}`);
    console.log(`    resources: ${result.resources ? result.resources.map(r => r.name).join(', ') : 'NONE ⚠️'}`);

    expect(result.message).toContain('Your safety and well-being are incredibly important');
    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();

    console.log('\n  ✅ CRISIS CRASH ROBUSTNESS SUCCESS: Fallback is crisis-specific with attached helplines');
  });

  test('when LLM returns malformed JSON during scanner high-risk (LLM called) → user gets fallback with crisis resources', async () => {
    registerHook('afterPromptBuild', (ctx) => {
      return { ...ctx, nextStep: 'continue' };
    });

    // LLM returns broken/non-JSON response
    callLLM.mockResolvedValueOnce({
      text: 'I am so sorry to hear that. Please know that help is available and you matter.',
      model: 'mistral',
      tokensUsed: 50
    });

    const result = await executePhase3({
      sessionId: 'crisis-session-malformed',
      therapistId: 'compassionate-listener',
      input: 'I want to kill myself',
      uid: 'crisis-user-malformed'
    });

    console.log('\n  Full pipeline result (LLM plain text crisis override test):');
    console.log(`    message: "${(result.message || '').substring(0, 80)}..."`);
    console.log(`    crisis_mode: ${result.crisis_mode}`);
    console.log(`    resources: ${result.resources ? result.resources.map(r => r.name).join(', ') : 'NONE ⚠️'}`);

    expect(result.crisis_mode).toBe(true);
    expect(result.resources).toBeDefined();

    console.log('\n  ✅ CRITICAL MALFORMED JSON SUCCESS: Fallback is successfully treated as crisis and resources are attached');
  });
});
