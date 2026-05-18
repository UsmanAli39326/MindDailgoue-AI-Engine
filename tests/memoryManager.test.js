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

  // Expose store for cleanup
  mockDb._store = store;

  return {
    default: { firestore: () => mockDb },
    db: mockDb
  };
});

const {
  getOrCreateSession,
  appendMessage,
  getRecentHistory,
  getSessionTherapistId,
  resetSession,
  clearAll,
  _internals
} = await import('../src/memoryManager.js');

describe('memoryManager', () => {
  beforeEach(async () => {
    await clearAll();
  });

  describe('Session Creation and Persona Locking', () => {
    test('creates new session and locks persona', async () => {
      const session = await getOrCreateSession('session1', 'personaA');
      expect(session.therapistId).toBe('personaA');
      expect(session.messages).toEqual([]);
      expect(await getSessionTherapistId('session1')).toBe('personaA');
    });

    test('retrieves existing session correctly if therapistId matches', async () => {
      await getOrCreateSession('session2', 'personaB');
      const session = await getOrCreateSession('session2', 'personaB');
      expect(session.therapistId).toBe('personaB');
    });

    test('throws if existing session is called with different therapistId', async () => {
      await getOrCreateSession('session3', 'personaC');
      await expect(getOrCreateSession('session3', 'personaD'))
        .rejects.toThrow(/Persona change rejected/);
    });
    
    test('throws on invalid arguments', async () => {
      await expect(getOrCreateSession('', 'id')).rejects.toThrow('sessionId must be a non-empty string.');
      await expect(getOrCreateSession('id', '')).rejects.toThrow('therapistId must be a non-empty string.');
    });
  });

  describe('Message Appending and History limit', () => {
    test('appends messages successfully', async () => {
      await getOrCreateSession('s1', 'therapist1');
      await appendMessage('s1', 'user', 'Hello');
      await appendMessage('s1', 'assistant', 'Hi there');
      
      const history = await getRecentHistory('s1');
      expect(history).toContain('User: Hello');
      expect(history).toContain('Assistant: Hi there');
    });

    test('enforces hard cap on messages (MAX_MESSAGES_PER_SESSION)', async () => {
      await getOrCreateSession('cap_test', 't1');
      
      const totalToAdd = _internals.MAX_MESSAGES_PER_SESSION + 10;
      
      for (let i = 0; i < totalToAdd; i++) {
        await appendMessage('cap_test', i % 2 === 0 ? 'user' : 'assistant', `Msg ${i}`);
      }

      const session = _internals.sessionStore.get('cap_test');
      expect(session.messages.length).toBe(_internals.MAX_MESSAGES_PER_SESSION);
      expect(session.messages[0].text).toBe('Msg 10');
    }, 45_000);

    test('throws when appending to non-existent session', async () => {
      await expect(appendMessage('invalid', 'user', 'test')).rejects.toThrow(/does not exist/);
    });
    
    test('throws on invalid message parameters', async () => {
      await getOrCreateSession('s1', 't1');
      await expect(appendMessage('s1', 'invalid_role', 'test')).rejects.toThrow('Role must be "user" or "assistant".');
      await expect(appendMessage('s1', 'user', '')).rejects.toThrow('Message text must be a non-empty string.');
    });
  });

  describe('Retrieval and reset', () => {
    test('getRecentHistory formats properly', async () => {
      await getOrCreateSession('s1', 't1');
      expect(await getRecentHistory('s1')).toBe('No previous conversation history.');
      
      await appendMessage('s1', 'user', 'A');
      await appendMessage('s1', 'assistant', 'B');
      expect(await getRecentHistory('s1')).toBe('User: A\nAssistant: B');
    });

    test('getRecentHistory respects maxMessages parameter', async () => {
      await getOrCreateSession('s1', 't1');
      for (let i = 0; i < 5; i++) {
        await appendMessage('s1', 'user', `Msg ${i}`);
      }
      
      const limited = await getRecentHistory('s1', 2);
      expect(limited).toContain('User: Msg 3');
      expect(limited).toContain('User: Msg 4');
      expect(limited).not.toContain('User: Msg 2');
    });

    test('resetSession removes the session', async () => {
      await getOrCreateSession('s1', 't1');
      await resetSession('s1');
      
      const session = await getOrCreateSession('s1', 't2');
      expect(session.therapistId).toBe('t2');
    });
  });
});
