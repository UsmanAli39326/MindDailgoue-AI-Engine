// ─────────────────────────────────────────────────────────────
// moodAggregation.js
// Aggregation utilities for mood analytics endpoints.
// Consumes raw mood log data and produces timeline, heatmap,
// and summary views.
// ─────────────────────────────────────────────────────────────

/**
 * Build a timeline from raw mood logs.
 * Returns daily entries sorted by date.
 *
 * @param {Array<{ date: string, entries: Array }>} logs
 * @returns {Array<{ date: string, entries: Array }>}
 */
export function buildTimeline(logs) {
  if (!Array.isArray(logs)) return [];
  return logs
    .map(day => ({
      date: day.date,
      entries: (day.entries || []).map(e => ({
        ts: e.ts,
        emotion: e.emotion,
        intensity: e.intensity,
        stress: e.stress,
        sessionId: e.sessionId,
      })),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build a heatmap from raw mood logs.
 * Returns one entry per day with averaged stress.
 *
 * @param {Array<{ date: string, entries: Array }>} logs
 * @returns {Array<{ date: string, avg_stress: number, entry_count: number }>}
 */
export function buildHeatmap(logs) {
  if (!Array.isArray(logs)) return [];

  return logs
    .map(day => {
      const entries = day.entries || [];
      if (entries.length === 0) return null;

      const avgStress = entries.reduce((sum, e) => sum + (e.stress || 0), 0) / entries.length;

      return {
        date: day.date,
        avg_stress: Math.round(avgStress * 100) / 100,
        entry_count: entries.length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Build a weekly emotion summary.
 * Returns emotion percentages over the last 7 days of data.
 *
 * @param {Array<{ date: string, entries: Array }>} logs
 * @returns {{ total_entries: number, emotions: Object<string, { count: number, percentage: number }>, dominant_emotion: string, avg_intensity: number, avg_stress: number }}
 */
export function buildSummary(logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    return {
      total_entries: 0,
      emotions: {},
      dominant_emotion: 'calm',
      avg_intensity: 0,
      avg_stress: 0,
    };
  }

  // Flatten all entries
  const allEntries = logs.flatMap(day => day.entries || []);
  const total = allEntries.length;

  if (total === 0) {
    return {
      total_entries: 0,
      emotions: {},
      dominant_emotion: 'calm',
      avg_intensity: 0,
      avg_stress: 0,
    };
  }

  // Count emotions
  const emotionCounts = {};
  let intensitySum = 0;
  let stressSum = 0;

  for (const entry of allEntries) {
    const emotion = entry.emotion || 'calm';
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    intensitySum += entry.intensity || 0;
    stressSum += entry.stress || 0;
  }

  // Build percentage map
  const emotions = {};
  for (const [emotion, count] of Object.entries(emotionCounts)) {
    emotions[emotion] = {
      count,
      percentage: Math.round((count / total) * 100),
    };
  }

  // Find dominant
  const dominant_emotion = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])[0][0];

  return {
    total_entries: total,
    emotions,
    dominant_emotion,
    avg_intensity: Math.round((intensitySum / total) * 100) / 100,
    avg_stress: Math.round((stressSum / total) * 100) / 100,
  };
}
