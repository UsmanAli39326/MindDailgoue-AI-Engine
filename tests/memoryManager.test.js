import {
  getOrCreateSession,
  appendMessage,
  getRecentHistory,
  getSessionTherapistId,
  resetSession,
  clearAll,
  _internals
} from '../src/memoryManager.js';

describe('memoryManager', () => {
  beforeEach(() => {
    clearAll();
  });

  describe('Session Creation and Persona Locking', () => {
    test('creates new session and locks persona', () => {
      const session = getOrCreateSession('session1', 'personaA');
      expect(session.therapistId).toBe('personaA');
      expect(session.messages).toEqual([]);
      expect(getSessionTherapistId('session1')).toBe('personaA');
    });

    test('retrieves existing session correctly if therapistId matches', () => {
      getOrCreateSession('session2', 'personaB');
      const session = getOrCreateSession('session2', 'personaB');
      expect(session.therapistId).toBe('personaB');
    });

    test('throws if existing session is called with different therapistId', () => {
      getOrCreateSession('session3', 'personaC');
      expect(() => getOrCreateSession('session3', 'personaD'))
        .toThrow(/Persona change rejected/);
    });
    
    test('throws on invalid arguments', () => {
        expect(() => getOrCreateSession('', 'id')).toThrow('sessionId must be a non-empty string.');
        expect(() => getOrCreateSession('id', '')).toThrow('therapistId must be a non-empty string.');
    });
  });

  describe('Message Appending and History limit', () => {
    test('appends messages successfully', () => {
      getOrCreateSession('s1', 'therapist1');
      appendMessage('s1', 'user', 'Hello');
      appendMessage('s1', 'assistant', 'Hi there');
      
      // We parse the generated history to verify
      const history = getRecentHistory('s1');
      expect(history).toContain('User: Hello');
      expect(history).toContain('Assistant: Hi there');
    });

    test('enforces hard cap on messages (MAX_MESSAGES_PER_SESSION)', () => {
      getOrCreateSession('cap_test', 't1');
      
      // Add 10 more than the max
      const totalToAdd = _internals.MAX_MESSAGES_PER_SESSION + 10;
      
      for (let i = 0; i < totalToAdd; i++) {
        appendMessage('cap_test', i % 2 === 0 ? 'user' : 'assistant', `Msg ${i}`);
      }

      // Check internal state directly
      const session = _internals.sessionStore.get('cap_test');
      expect(session.messages.length).toBe(_internals.MAX_MESSAGES_PER_SESSION);
      
      // The oldest messages should be gone
      expect(session.messages[0].text).toBe('Msg 10'); // because 0..9 were dropped
    });

    test('throws when appending to non-existent session', () => {
      expect(() => appendMessage('invalid', 'user', 'test')).toThrow(/does not exist/);
    });
    
    test('throws on invalid message parameters', () => {
      getOrCreateSession('s1', 't1');
      expect(() => appendMessage('s1', 'invalid_role', 'test')).toThrow('Role must be "user" or "assistant".');
      expect(() => appendMessage('s1', 'user', '')).toThrow('Message text must be a non-empty string.');
    });
  });

  describe('Retrieval and reset', () => {
    test('getRecentHistory formats properly', () => {
      getOrCreateSession('s1', 't1');
      expect(getRecentHistory('s1')).toBe('No previous conversation history.');
      
      appendMessage('s1', 'user', 'A');
      appendMessage('s1', 'assistant', 'B');
      expect(getRecentHistory('s1')).toBe('User: A\nAssistant: B');
    });

    test('getRecentHistory respects maxMessages parameter', () => {
      getOrCreateSession('s1', 't1');
      for (let i = 0; i < 5; i++) {
        appendMessage('s1', 'user', `Msg ${i}`);
      }
      
      const limited = getRecentHistory('s1', 2);
      expect(limited).toContain('User: Msg 3');
      expect(limited).toContain('User: Msg 4');
      expect(limited).not.toContain('User: Msg 2');
    });

    test('resetSession removes the session', () => {
        getOrCreateSession('s1', 't1');
        resetSession('s1');
        
        // This should not throw now since session was deleted
        const session = getOrCreateSession('s1', 't2');
        expect(session.therapistId).toBe('t2');
    });
  });
});
