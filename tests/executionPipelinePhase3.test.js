import { jest } from '@jest/globals';

// ── Mock Firebase so tests never hit real Firestore ──────────
jest.unstable_mockModule('../src/config/firebase.js', () => {
  const store = {};
  const mockDb = {
    collection: (colName) => ({
      doc: (docId) => {
        const key = `${colName}/${docId}`;
        return {
          get: jest.fn(async () => {
            if (store[key]) {
              return { exists: true, data: () => ({ ...store[key] }) };
            }
            return { exists: false, data: () => null };
          }),
          set: jest.fn(async (data) => { store[key] = { ...data }; }),
          update: jest.fn(async (data) => {
            if (!store[key]) throw new Error(`No document to update: ${key}`);
            store[key] = { ...store[key], ...data };
          }),
          delete: jest.fn(async () => { delete store[key]; })
        };
      },
      get: jest.fn(async () => {
        const docs = Object.entries(store)
          .filter(([k]) => k.startsWith(`${colName}/`))
          .map(([k, v]) => ({ ref: { path: k }, data: () => v }));
        return { docs };
      })
    }),
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(ref.path),
        commit: jest.fn(async () => {
          ops.forEach(path => { delete store[path]; });
        })
      };
    }
  };
  return {
    default: { firestore: () => mockDb },
    db: mockDb
  };
});

jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn()
}));
jest.unstable_mockModule('../src/middleware/crisisHandler.js', () => ({
  isUserInCooldown: jest.fn().mockReturnValue(false),
  handleCrisis: jest.fn().mockImplementation(async response => response)
}));
jest.unstable_mockModule('../src/personaManager.js', () => ({
  getPersonaById: jest.fn().mockResolvedValue({
    id: 'compassionate-listener',
    name: 'Dr. Amara',
    style: 'Warm',
    tone: 'Gentle',
    personalityPrompt: 'You are Dr. Amara.',
    initialMessage: 'Hello.'
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
jest.unstable_mockModule('../src/services/userService.js', () => ({
  getUserBasicInfo: jest.fn().mockResolvedValue(null),
  updateLastActive: jest.fn()
}));

describe('executionPipelinePhase3', () => {
  let executePhase3;
  let llmClientMock;
  let vectorMemoryMock;
  let userProfileManager;

  beforeAll(async () => {
    const client = await import('../src/llmClient.js');
    llmClientMock = client.callLLM;
    
    const vectorMem = await import('../src/vectorMemoryManager.js');
    vectorMemoryMock = vectorMem;

    userProfileManager = await import('../src/userProfileManager.js');
    
    const pipe = await import('../src/executionPipelinePhase3.js');
    executePhase3 = pipe.executePhase3;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userProfileManager.clearAll();
  });

  test('executes pipeline and stores memory appropriately', async () => {
    llmClientMock.mockResolvedValueOnce({ text: 'Safe therapeutic response', model: 'test' });

    // "I feel sad because my husband left" triggers memoryFilter 'high' and personal pattern
    const result = await executePhase3({
      sessionId: 'test-session',
      therapistId: 'compassionate-listener',
      input: 'I feel sad because my husband left me'
    });

    // LLM should be called
    expect(llmClientMock).toHaveBeenCalledTimes(1);

    // Vector memory store should be called because it passes filter
    expect(vectorMemoryMock.storeMemory).toHaveBeenCalledTimes(1);
    const storeArgs = vectorMemoryMock.storeMemory.mock.calls[0];
    expect(storeArgs[0]).toBe('test-session'); // session id
    expect(storeArgs[1]).toContain('husband'); // should be the compressed/truncated text
    expect(storeArgs[2].importance).toBe('high');

    // Vector memory retrieval should be called
    expect(vectorMemoryMock.retrieveRelevantMemories).toHaveBeenCalledTimes(1);

    // Profile should be updated
    expect(result.profileUpdated).toBe(true);
    expect(result.metadata.wasFallback).toBe(false);
  });

  test('does not store casual talk but still responds', async () => {
    llmClientMock.mockResolvedValueOnce({ text: 'Hello there!', model: 'test' });

    const result = await executePhase3({
      sessionId: 'test-session-2',
      therapistId: 'compassionate-listener',
      input: 'hi' // Too short, no emotions
    });

    expect(llmClientMock).toHaveBeenCalledTimes(1);
    expect(vectorMemoryMock.storeMemory).not.toHaveBeenCalled();
    expect(result.message).toBe('Hello there!');
  });
});
