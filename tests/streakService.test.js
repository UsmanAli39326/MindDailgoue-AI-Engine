// ─────────────────────────────────────────────────────────────
// streakService.test.js
// Tests for user streaks, transactions, and grace period calculations.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';

// Store reference to transactional callback
let transactionCallback;

// Mock config/firebase.js to avoid active database connection issues
jest.unstable_mockModule('../src/config/firebase.js', () => ({
  db: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        currentStreak: 2,
        longestStreak: 2,
        lastActiveDate: '2026-05-15',
        graceUsed: false,
        totalDays: 2,
        activityDates: ['2026-05-14', '2026-05-15'],
      }),
    }),
    runTransaction: jest.fn(async (cb) => {
      transactionCallback = cb;
      // Execute with mock transaction object
      const mockTransaction = {
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
      };
      await cb(mockTransaction);
    }),
  }
}));

describe('streakService', () => {
  let getStreakStatus;
  let recordActivity;
  let firebaseMock;

  beforeAll(async () => {
    const firebase = await import('../src/config/firebase.js');
    firebaseMock = firebase.db;

    const module = await import('../src/services/streakService.js');
    getStreakStatus = module.getStreakStatus;
    recordActivity = module.recordActivity;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getStreakStatus', () => {
    test('retrieves current streak data successfully from Firestore', async () => {
      const status = await getStreakStatus('user123');

      expect(status.currentStreak).toBe(2);
      expect(status.longestStreak).toBe(2);
      expect(status.totalDays).toBe(2);
      expect(status.graceUsed).toBe(false);

      expect(firebaseMock.collection).toHaveBeenCalledWith('users');
      expect(firebaseMock.doc).toHaveBeenCalledWith('user123');
      expect(firebaseMock.collection).toHaveBeenCalledWith('streaks');
    });

    test('returns default object if streak document does not exist', async () => {
      firebaseMock.get.mockResolvedValueOnce({ exists: false });

      const status = await getStreakStatus('newuser');

      expect(status.currentStreak).toBe(0);
      expect(status.longestStreak).toBe(0);
      expect(status.totalDays).toBe(0);
    });
  });

  describe('recordActivity - Transactions & Grace Periods', () => {
    test('creates new streak record on first activity ever', async () => {
      const mockTransaction = {
        get: jest.fn().mockResolvedValueOnce({ exists: false }),
        set: jest.fn(),
        update: jest.fn(),
      };

      firebaseMock.runTransaction.mockImplementationOnce(async (cb) => {
        await cb(mockTransaction);
      });

      recordActivity('user_new');

      // We wait for microtasks to resolve so async transaction finishes execution
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTransaction.set).toHaveBeenCalled();
      const newStreakPayload = mockTransaction.set.mock.calls[0][1];
      expect(newStreakPayload.currentStreak).toBe(1);
      expect(newStreakPayload.graceUsed).toBe(false);
      expect(newStreakPayload.totalDays).toBe(1);
    });

    test('increments streak count on consecutive day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const mockTransaction = {
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          data: () => ({
            currentStreak: 5,
            longestStreak: 5,
            lastActiveDate: yesterdayStr,
            graceUsed: true, // will be reset on consecutive day success
            totalDays: 5,
            activityDates: [yesterdayStr],
          })
        }),
        set: jest.fn(),
        update: jest.fn(),
      };

      firebaseMock.runTransaction.mockImplementationOnce(async (cb) => {
        await cb(mockTransaction);
      });

      recordActivity('user_consecutive');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTransaction.update).toHaveBeenCalled();
      const updatedFields = mockTransaction.update.mock.calls[0][1];
      expect(updatedFields.currentStreak).toBe(6);
      expect(updatedFields.longestStreak).toBe(6);
      expect(updatedFields.graceUsed).toBe(false); // Grace is reset to false
    });

    test('utilizes 48-hour grace period if exactly 1 day is missed', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().slice(0, 10);

      const mockTransaction = {
        get: jest.fn().mockResolvedValueOnce({
          exists: true,
          data: () => ({
            currentStreak: 3,
            longestStreak: 3,
            lastActiveDate: twoDaysAgoStr,
            graceUsed: false,
            totalDays: 3,
            activityDates: [twoDaysAgoStr],
          })
        }),
        set: jest.fn(),
        update: jest.fn(),
      };

      firebaseMock.runTransaction.mockImplementationOnce(async (cb) => {
        await cb(mockTransaction);
      });

      recordActivity('user_grace');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockTransaction.update).toHaveBeenCalled();
      const updatedFields = mockTransaction.update.mock.calls[0][1];
      expect(updatedFields.currentStreak).toBe(4); // Continues!
      expect(updatedFields.graceUsed).toBe(true); // grace marked active
    });
  });
});
