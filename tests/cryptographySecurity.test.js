// ─────────────────────────────────────────────────────────────
// cryptographySecurity.test.js
// Specialized security integration tests asserting that
// therapeutic messages, mood logs, and memory summaries
// are fully encrypted at-rest and cleanly decrypted on retrieval.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';

// Setup Mock for firebase-admin/firestore FieldValue
jest.unstable_mockModule('firebase-admin/firestore', () => ({
  FieldValue: {
    arrayUnion: jest.fn().mockImplementation((val) => ({
      _arrayUnionValue: val
    })),
    increment: jest.fn().mockImplementation((val) => ({
      _incrementValue: val
    }))
  }
}));

// Setup Mock for Firebase Admin SDK
jest.unstable_mockModule('../src/config/firebase.js', () => {
  const mockDb = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 'mock-doc-id' }),
    set: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
  };
  return {
    db: mockDb,
    default: {
      firestore: () => mockDb,
    }
  };
});

// Setup Mock for LLM Client
jest.unstable_mockModule('../src/llmClient.js', () => ({
  callLLM: jest.fn().mockResolvedValue({
    text: JSON.stringify({
      summary: 'The client expressed feelings of overwhelm.',
      themes: ['stress']
    })
  })
}));

describe('Security Encryption Layer', () => {
  let encrypt;
  let decrypt;
  let storeEncryptedMessage;
  let getSessionMessages;
  let summarizeAndStore;
  let fetchMemoryBlobs;
  let logMood;
  let getMoodLogForDate;
  let firebaseMock;

  beforeAll(async () => {
    // Import encryption service
    const encService = await import('../src/src/services/encryptionService.js').catch(async () => {
      // support relative root structure
      return await import('../src/services/encryptionService.js');
    });
    encrypt = encService.encrypt;
    decrypt = encService.decrypt;

    // Import firebase mock
    const firebase = await import('../src/config/firebase.js');
    firebaseMock = firebase.db;

    // Import services
    const storageModule = await import('../src/services/encryptedStorage.js');
    storeEncryptedMessage = storageModule.storeEncryptedMessage;
    getSessionMessages = storageModule.getSessionMessages;

    const summarizerModule = await import('../src/services/sessionSummarizer.js');
    summarizeAndStore = summarizerModule.summarizeAndStore;

    const contextModule = await import('../src/services/memoryContext.js');
    fetchMemoryBlobs = contextModule.fetchMemoryBlobs;

    const moodModule = await import('../src/services/moodService.js');
    logMood = moodModule.logMood;
    getMoodLogForDate = moodModule.getMoodLogForDate;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('encryptionService (AES-256-GCM)', () => {
    test('symmetrically encrypts and decrypts strings correctly', () => {
      const originalText = 'Highly confidential psychiatric session details.';
      const encrypted = encrypt(originalText);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.ciphertext).not.toBe(originalText);

      const decrypted = decrypt(encrypted.ciphertext, encrypted.iv);
      expect(decrypted).toBe(originalText);
    });

    test('transparently passes through legacy iv: "plaintext" records', () => {
      const plaintext = 'Plain message';
      const result = decrypt(plaintext, 'plaintext');
      expect(result).toBe(plaintext);
    });

    test('throws structured error for malformed or tampered encrypted structure', () => {
      expect(() => decrypt('badciphertext', 'badiv')).toThrow();
    });
  });

  describe('encryptedStorage (Server-Side Auto-Encryption)', () => {
    test('auto-encrypts plaintext messages on the fly when iv is "plaintext"', async () => {
      const payload = {
        ciphertext: 'Confidential patient input.',
        iv: 'plaintext',
        sessionId: 'session123',
        role: 'user',
      };

      firebaseMock.add.mockResolvedValueOnce({ id: 'msg-id-123' });

      const result = await storeEncryptedMessage('user123', payload);

      expect(result).not.toBeNull();
      expect(firebaseMock.add).toHaveBeenCalled();

      // Check captured add parameter to ensure it was encrypted before database save
      const storedDoc = firebaseMock.add.mock.calls[0][0];
      expect(storedDoc.iv).not.toBe('plaintext');
      expect(storedDoc.ciphertext).not.toBe('Confidential patient input.');

      // Decryption assertion
      const decryptedStored = decrypt(storedDoc.ciphertext, storedDoc.iv);
      expect(decryptedStored).toBe('Confidential patient input.');
    });

    test('transparently returns decrypted messages on retrieval', async () => {
      // Mock two messages: one server-encrypted and one client-encrypted
      const serverEnc = encrypt('Server encrypted message.');
      
      const mockDocs = [
        {
          id: 'm1',
          data: () => ({
            ciphertext: serverEnc.ciphertext,
            iv: serverEnc.iv,
            sessionId: 'session123',
            role: 'assistant',
          }),
        },
        {
          id: 'm2',
          data: () => ({
            ciphertext: 'clientciphertext',
            iv: 'clientiv',
            sessionId: 'session123',
            role: 'user',
          }),
        }
      ];

      firebaseMock.get.mockResolvedValueOnce({
        docs: mockDocs
      });

      const result = await getSessionMessages('user123', 'session123', 5);

      expect(result.messages).toHaveLength(2);
      // Automatically decrypted for server encrypted message
      expect(result.messages[0].ciphertext).toBe('Server encrypted message.');
      // Kept intact as ciphertext for client-side (E2E) message
      expect(result.messages[1].ciphertext).toBe('clientciphertext');
    });
  });

  describe('sessionSummarizer (Memory Summary Encryption)', () => {
    test('automatically encrypts clinical summaries before saving', async () => {
      const messages = ['User: help', 'Assistant: I am here'];
      
      // Mock add to capture saved document
      firebaseMock.add.mockResolvedValueOnce({ id: 'summary-id-999' });

      // Mock callLLM is already pre-configured at module-level to return static test summary

      const result = await summarizeAndStore('user123', 'session123', messages);

      expect(result).not.toBeNull();
      expect(firebaseMock.add).toHaveBeenCalled();

      // Check captured summary document
      const storedDoc = firebaseMock.add.mock.calls[0][0];
      expect(storedDoc.iv).toBeDefined();
      expect(storedDoc.summary).not.toBe('The client expressed feelings of overwhelm.');

      const decrypted = decrypt(storedDoc.summary, storedDoc.iv);
      expect(decrypted).toBe('The client expressed feelings of overwhelm.');
    });

    test('automatically decrypts clinical summaries on fetch for context construction', async () => {
      const encSummary = encrypt('Active panic triggers.');
      const mockDocs = [
        {
          id: 's1',
          data: () => ({
            summary: encSummary.ciphertext,
            iv: encSummary.iv,
            themes: ['anxiety'],
            createdAt: '2026-05-18T00:00:00Z',
            sessionId: 'session123',
          })
        }
      ];

      firebaseMock.get.mockResolvedValueOnce({
        empty: false,
        docs: mockDocs
      });

      const blobs = await fetchMemoryBlobs('user123');

      expect(blobs).toHaveLength(1);
      expect(blobs[0].summary).toBe('Active panic triggers.');
    });
  });

  describe('moodService (Patient Emotion Log Encryption)', () => {
    test('encrypts patient daily emotions and decrypts them on retrieval', async () => {
      firebaseMock.set.mockResolvedValueOnce(true);

      // Trigger mood log write
      logMood('user123', 'session123', {
        emotion: 'depressed',
        intensity: 0.9,
        stress_level: 0.8
      });

      expect(firebaseMock.set).toHaveBeenCalled();

      // Capture doc payload
      const setArg = firebaseMock.set.mock.calls[0][0];
      const entries = setArg.entries._arrayUnionValue;
      
      expect(entries.iv).toBeDefined();
      expect(entries.emotion).not.toBe('depressed');

      const decryptedEmotion = decrypt(entries.emotion, entries.iv);
      expect(decryptedEmotion).toBe('depressed');

      // Test retrieval decryption
      firebaseMock.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          entries: [
            {
              emotion: entries.emotion,
              iv: entries.iv,
              intensity: 0.9,
              stress: 0.8,
            }
          ]
        })
      });

      const log = await getMoodLogForDate('user123', '2026-05-18');
      expect(log.entries[0].emotion).toBe('depressed');
    });
  });
});
