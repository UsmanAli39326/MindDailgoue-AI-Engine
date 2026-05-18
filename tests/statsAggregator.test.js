// ─────────────────────────────────────────────────────────────
// statsAggregator.test.js
// Tests for unified statistics compiling and badge awarding.
// ─────────────────────────────────────────────────────────────

import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/config/firebase.js', () => ({
  db: {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    get: jest.fn().mockImplementation(async (path) => {
      // Simulate insights / latest document
      return {
        exists: true,
        data: () => ({
          insight: 'Real weekly progress.',
          prompt: 'How do you feel today?',
          generatedAt: '2026-05-16T12:00:00Z',
        }),
      };
    }),
  }
}));

// Mock moodService & streakService to isolate statsAggregator
jest.unstable_mockModule('../src/services/streakService.js', () => ({
  getStreakStatus: jest.fn().mockResolvedValue({
    currentStreak: 7,
    longestStreak: 7,
    totalDays: 10,
    graceUsed: false,
  })
}));

jest.unstable_mockModule('../src/services/moodService.js', () => ({
  getMoodLogs: jest.fn().mockResolvedValue([
    {
      date: '2026-05-15',
      entries: [{ emotion: 'calm', intensity: 0.5, stress: 0.2 }],
    },
    {
      date: '2026-05-16',
      entries: [{ emotion: 'calm', intensity: 0.6, stress: 0.3 }],
    },
  ])
}));

describe('statsAggregator', () => {
  let getUnifiedStats;
  let firebaseMock;

  beforeAll(async () => {
    const firebase = await import('../src/config/firebase.js');
    firebaseMock = firebase.db;

    const module = await import('../src/services/statsAggregator.js');
    getUnifiedStats = module.getUnifiedStats;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnifiedStats', () => {
    test('successfully compiles streaks, weekly sessions, dominant emotion, and badges', async () => {
      // Mock session queries
      const mockSessionsSnapshot = {
        size: 5,
        docs: [
          { data: () => ({ createdAt: new Date().toISOString() }) },
          { data: () => ({ createdAt: new Date().toISOString() }) },
          { data: () => ({ createdAt: '2026-05-01T12:00:00Z' }) }, // older than 7 days
        ],
      };

      firebaseMock.get.mockImplementation(async () => {
        return mockSessionsSnapshot;
      });

      const stats = await getUnifiedStats('user123');

      expect(stats.streak.current).toBe(7);
      expect(stats.streak.longest).toBe(7);
      expect(stats.sessions.total).toBe(5);
      expect(stats.sessions.thisWeek).toBe(2); // exactly 2 matching today's ISO string
      expect(stats.topEmotion).toBe('calm');

      // Awarded badges: first-session (total >= 1), 3-day-streak, 7-day-streak
      expect(stats.badges).toContain('first-session');
      expect(stats.badges).toContain('3-day-streak');
      expect(stats.badges).toContain('7-day-streak');
      expect(stats.badges).not.toContain('reflection-master'); // totalDays = 10 < 30
    });
  });
});
