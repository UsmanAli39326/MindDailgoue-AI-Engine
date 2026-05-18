// ─────────────────────────────────────────────────────────────
// syncResiliency.test.js
// Integration tests verifying E2E sync resiliency and client-id
// message deduplication during offline batch recovery.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';
import {
  storeEncryptedMessage,
  storeBatchMessages,
  deleteSessionMessages
} from '../src/services/encryptedStorage.js';

describe('Sync Resiliency & Client-ID Deduplication', () => {
  const TEST_UID = 'sync-resilience-user';
  const TEST_SESSION = 'sync-session-uuid';

  beforeEach(async () => {
    await deleteSessionMessages(TEST_UID, TEST_SESSION);
    jest.clearAllMocks();
  });

  test('successfully stores a single new message with client_id', async () => {
    const payload = {
      ciphertext: 'Hello therapist, I need support.',
      iv: 'plaintext',
      sessionId: TEST_SESSION,
      role: 'user',
      client_id: 'local-msg-101',
    };

    const result = await storeEncryptedMessage(TEST_UID, payload);

    expect(result).not.toBeNull();
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeDefined();
    expect(result.duplicate).toBeUndefined();
  });

  test('deduplicates duplicate messages carrying the same client_id (Idempotency)', async () => {
    const payload = {
      ciphertext: 'Hello therapist, I need support.',
      iv: 'plaintext',
      sessionId: TEST_SESSION,
      role: 'user',
      client_id: 'local-msg-102',
    };

    // First store
    const firstResult = await storeEncryptedMessage(TEST_UID, payload);
    expect(firstResult).not.toBeNull();
    expect(firstResult.duplicate).toBeUndefined();

    // Second store with identical client_id (simulate duplicate upload retry)
    const secondResult = await storeEncryptedMessage(TEST_UID, payload);

    expect(secondResult).not.toBeNull();
    expect(secondResult.id).toBe(firstResult.id); // Must return the exact same document ID
    expect(secondResult.duplicate).toBe(true); // Must flag as duplicate
  }, 15_000);

  test('successfully processes batch message synchronization', async () => {
    const batch = [
      { ciphertext: 'Msg A', iv: 'plaintext', sessionId: TEST_SESSION, role: 'user', client_id: 'b-1' },
      { ciphertext: 'Msg B', iv: 'plaintext', sessionId: TEST_SESSION, role: 'assistant', client_id: 'b-2' },
      { ciphertext: 'Msg C', iv: 'plaintext', sessionId: TEST_SESSION, role: 'user', client_id: 'b-3' },
    ];

    const results = await storeBatchMessages(TEST_UID, batch);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[0].client_id).toBe('b-1');
    expect(results[0].duplicate).toBeUndefined();

    expect(results[1].success).toBe(true);
    expect(results[1].client_id).toBe('b-2');

    expect(results[2].success).toBe(true);
    expect(results[2].client_id).toBe('b-3');
  }, 30_000);

  test('resiliently handles duplicate batch uploads without double-writing records', async () => {
    const batch = [
      { ciphertext: 'Msg 1', iv: 'plaintext', sessionId: TEST_SESSION, role: 'user', client_id: 'dup-batch-1' },
      { ciphertext: 'Msg 2', iv: 'plaintext', sessionId: TEST_SESSION, role: 'assistant', client_id: 'dup-batch-2' },
    ];

    // First upload
    const firstBatchResult = await storeBatchMessages(TEST_UID, batch);
    expect(firstBatchResult[0].duplicate).toBeUndefined();
    expect(firstBatchResult[1].duplicate).toBeUndefined();

    // Second upload (e.g. duplicate retry or sync race condition)
    const secondBatchResult = await storeBatchMessages(TEST_UID, batch);

    expect(secondBatchResult[0].success).toBe(true);
    expect(secondBatchResult[0].server_id).toBe(firstBatchResult[0].server_id);
    expect(secondBatchResult[0].duplicate).toBe(true);

    expect(secondBatchResult[1].success).toBe(true);
    expect(secondBatchResult[1].server_id).toBe(firstBatchResult[1].server_id);
    expect(secondBatchResult[1].duplicate).toBe(true);
  }, 30_000);
});
