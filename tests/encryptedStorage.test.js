// ─────────────────────────────────────────────────────────────
// encryptedStorage.test.js
// Tests for encrypted storage message schema, single store,
// and batch store.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';

// Mock config/firebase.js to avoid active Firestore connectivity issues during tests.
// The actual storage routes will mock out Firestore anyway.
jest.unstable_mockModule('../src/config/firebase.js', () => {
  const mockDb = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    startAfter: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    add: jest.fn().mockResolvedValue({ id: 'mock-msg-id' }),
    update: jest.fn().mockResolvedValue(true),
  };
  return {
    db: mockDb,
    default: {
      firestore: () => mockDb,
    }
  };
});

describe('encryptedStorage', () => {
  let storeEncryptedMessage;
  let storeBatchMessages;
  let getSessionMessages;
  let firebaseMock;

  beforeAll(async () => {
    const firebase = await import('../src/config/firebase.js');
    firebaseMock = firebase.db;

    const module = await import('../src/services/encryptedStorage.js');
    storeEncryptedMessage = module.storeEncryptedMessage;
    storeBatchMessages = module.storeBatchMessages;
    getSessionMessages = module.getSessionMessages;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('storeEncryptedMessage', () => {
    test('successfully stores a valid encrypted message payload', async () => {
      const message = {
        ciphertext: 'cipher123',
        iv: 'iv123',
        sessionId: 'session123',
        role: 'user',
        client_id: 'client123',
      };

      const result = await storeEncryptedMessage('user123', message);

      expect(result).not.toBeNull();
      expect(result.id).toBe('mock-msg-id');
      expect(result.timestamp).toBeDefined();

      expect(firebaseMock.collection).toHaveBeenCalledWith('users');
      expect(firebaseMock.doc).toHaveBeenCalledWith('user123');
      expect(firebaseMock.collection).toHaveBeenCalledWith('messages');
    });

    test('rejects payloads missing required encryption fields', async () => {
      const invalid = { ciphertext: 'cipher123' }; // missing iv and sessionId
      const result = await storeEncryptedMessage('user123', invalid);

      expect(result).toBeNull();
    });
  });

  describe('storeBatchMessages', () => {
    test('processes and returns results for multiple messages sequentially', async () => {
      const messages = [
        { ciphertext: 'cipher1', iv: 'iv1', sessionId: 's1', client_id: 'c1' },
        { ciphertext: 'cipher2', iv: 'iv2', sessionId: 's1', client_id: 'c2' },
      ];

      const results = await storeBatchMessages('user123', messages);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].client_id).toBe('c1');
      expect(results[0].server_id).toBe('mock-msg-id');

      expect(results[1].success).toBe(true);
      expect(results[1].client_id).toBe('c2');
    });

    test('handles empty batches gracefully', async () => {
      const results = await storeBatchMessages('user123', []);
      expect(results).toEqual([]);
    });
  });

  describe('getSessionMessages', () => {
    test('successfully retrieves session messages with ordering and limits', async () => {
      const mockDocs = [
        { id: 'msg1', data: () => ({ ciphertext: 'c1', timestamp: '2026-05-17T12:00:00Z' }) },
        { id: 'msg2', data: () => ({ ciphertext: 'c2', timestamp: '2026-05-17T12:01:00Z' }) }
      ];

      firebaseMock.get.mockResolvedValueOnce({
        docs: mockDocs
      });

      const result = await getSessionMessages('user123', 'session123', 2);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].id).toBe('msg1');
      expect(result.messages[1].id).toBe('msg2');
      expect(result.hasMore).toBe(false);

      expect(firebaseMock.collection).toHaveBeenCalledWith('messages');
      expect(firebaseMock.where).toHaveBeenCalledWith('sessionId', '==', 'session123');
      expect(firebaseMock.orderBy).toHaveBeenCalledWith('timestamp', 'asc');
      expect(firebaseMock.limit).toHaveBeenCalledWith(3); // limit + 1
    });

    test('sets hasMore to true if retrieved count exceeds limit', async () => {
      const mockDocs = [
        { id: 'msg1', data: () => ({ ciphertext: 'c1' }) },
        { id: 'msg2', data: () => ({ ciphertext: 'c2' }) },
        { id: 'msg3', data: () => ({ ciphertext: 'c3' }) }
      ];

      firebaseMock.get.mockResolvedValueOnce({
        docs: mockDocs
      });

      const result = await getSessionMessages('user123', 'session123', 2);

      expect(result.messages).toHaveLength(2); // sliced to limit
      expect(result.hasMore).toBe(true);
      expect(firebaseMock.limit).toHaveBeenCalledWith(3);
    });

    test('supports startAfter cursor pagination', async () => {
      const mockStartAfterDoc = {
        exists: true,
        id: 'msg1',
        data: () => ({ ciphertext: 'c1' })
      };

      const mockDocs = [
        { id: 'msg2', data: () => ({ ciphertext: 'c2' }) }
      ];

      // First get() is for startAfter document snapshot
      firebaseMock.get.mockResolvedValueOnce(mockStartAfterDoc);
      // Second get() is for the paginated query snapshot
      firebaseMock.get.mockResolvedValueOnce({
        docs: mockDocs
      });

      const result = await getSessionMessages('user123', 'session123', 2, 'msg1');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].id).toBe('msg2');
      expect(result.hasMore).toBe(false);

      expect(firebaseMock.doc).toHaveBeenCalledWith('msg1');
      expect(firebaseMock.startAfter).toHaveBeenCalledWith(mockStartAfterDoc);
    });
  });
});
