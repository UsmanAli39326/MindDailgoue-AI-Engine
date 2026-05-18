// ─────────────────────────────────────────────────────────────
// moodAggregation.test.js
// Tests for mood analytics aggregation functions.
// ─────────────────────────────────────────────────────────────

import { buildTimeline, buildHeatmap, buildSummary } from '../src/services/moodAggregation.js';

const SAMPLE_LOGS = [
  {
    date: '2026-05-15',
    entries: [
      { ts: '2026-05-15T10:00:00Z', emotion: 'anxious', intensity: 0.7, stress: 0.8, sessionId: 's1' },
      { ts: '2026-05-15T14:00:00Z', emotion: 'calm', intensity: 0.3, stress: 0.2, sessionId: 's1' },
    ],
  },
  {
    date: '2026-05-16',
    entries: [
      { ts: '2026-05-16T09:00:00Z', emotion: 'sad', intensity: 0.6, stress: 0.5, sessionId: 's2' },
      { ts: '2026-05-16T18:00:00Z', emotion: 'anxious', intensity: 0.8, stress: 0.9, sessionId: 's2' },
      { ts: '2026-05-16T20:00:00Z', emotion: 'calm', intensity: 0.2, stress: 0.1, sessionId: 's2' },
    ],
  },
];

describe('moodAggregation', () => {

  describe('buildTimeline', () => {
    test('returns sorted daily entries', () => {
      const result = buildTimeline(SAMPLE_LOGS);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-05-15');
      expect(result[1].date).toBe('2026-05-16');
      expect(result[0].entries).toHaveLength(2);
      expect(result[1].entries).toHaveLength(3);
    });

    test('handles empty input', () => {
      expect(buildTimeline([])).toEqual([]);
      expect(buildTimeline(null)).toEqual([]);
    });
  });

  describe('buildHeatmap', () => {
    test('returns averaged stress per day', () => {
      const result = buildHeatmap(SAMPLE_LOGS);

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2026-05-15');
      expect(result[0].avg_stress).toBe(0.5);  // (0.8 + 0.2) / 2
      expect(result[0].entry_count).toBe(2);

      expect(result[1].date).toBe('2026-05-16');
      expect(result[1].avg_stress).toBe(0.5);  // (0.5 + 0.9 + 0.1) / 3
      expect(result[1].entry_count).toBe(3);
    });

    test('filters out days with no entries', () => {
      const logs = [{ date: '2026-05-17', entries: [] }];
      expect(buildHeatmap(logs)).toEqual([]);
    });

    test('handles empty input', () => {
      expect(buildHeatmap([])).toEqual([]);
      expect(buildHeatmap(null)).toEqual([]);
    });
  });

  describe('buildSummary', () => {
    test('returns emotion percentages and dominant emotion', () => {
      const result = buildSummary(SAMPLE_LOGS);

      expect(result.total_entries).toBe(5);
      expect(result.dominant_emotion).toBe('anxious'); // 2 anxious vs 2 calm vs 1 sad
      expect(result.emotions.anxious.count).toBe(2);
      expect(result.emotions.calm.count).toBe(2);
      expect(result.emotions.sad.count).toBe(1);
      expect(result.emotions.anxious.percentage).toBe(40);
      expect(result.emotions.sad.percentage).toBe(20);
    });

    test('calculates avg_intensity and avg_stress', () => {
      const result = buildSummary(SAMPLE_LOGS);

      // (0.7 + 0.3 + 0.6 + 0.8 + 0.2) / 5 = 0.52
      expect(result.avg_intensity).toBe(0.52);
      // (0.8 + 0.2 + 0.5 + 0.9 + 0.1) / 5 = 0.5
      expect(result.avg_stress).toBe(0.5);
    });

    test('handles empty logs', () => {
      const result = buildSummary([]);

      expect(result.total_entries).toBe(0);
      expect(result.dominant_emotion).toBe('calm');
      expect(result.avg_intensity).toBe(0);
      expect(result.avg_stress).toBe(0);
    });

    test('handles null input', () => {
      const result = buildSummary(null);
      expect(result.total_entries).toBe(0);
    });
  });
});
