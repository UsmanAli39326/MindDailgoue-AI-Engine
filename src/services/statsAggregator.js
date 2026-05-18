// ─────────────────────────────────────────────────────────────
// statsAggregator.js
// Aggregates streak status, session stats, weekly session frequency,
// top emotion, latest insights, and awarded badges into a unified payload.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { getStreakStatus } from './streakService.js';
import { buildSummary } from './moodAggregation.js';
import { getMoodLogs } from './moodService.js';

/**
 * Retrieve unified user statistics.
 * @param {string} uid
 * @returns {Promise<Object>}
 */
export async function getUnifiedStats(uid) {
  if (!uid || !db) {
    return {
      streak: { current: 0, longest: 0, totalDays: 0 },
      sessions: { total: 0, thisWeek: 0 },
      topEmotion: 'calm',
      insight: null,
      badges: [],
    };
  }

  try {
    // 1. Fetch Streak Status
    const streak = await getStreakStatus(uid);

    // 2. Fetch Sessions statistics
    const sessionsSnapshot = await db.collection('users').doc(uid).collection('sessions').get();
    const totalSessions = sessionsSnapshot.size;

    let sessionsThisWeek = 0;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoISO = oneWeekAgo.toISOString();

    sessionsSnapshot.docs.forEach(doc => {
      const createdAt = doc.data().createdAt;
      if (createdAt && createdAt >= oneWeekAgoISO) {
        sessionsThisWeek++;
      }
    });

    // 3. Fetch Top Emotion (using last 14 days of logs)
    const logs = await getMoodLogs(uid, 14);
    const summary = buildSummary(logs);
    const topEmotion = summary.dominant_emotion || 'calm';

    // 4. Fetch Latest Insight
    const insightDoc = await db.collection('users').doc(uid).collection('insights').doc('latest').get();
    let insight = null;
    if (insightDoc.exists) {
      const data = insightDoc.data();
      insight = {
        text: data.insight || null,
        prompt: data.prompt || null,
        generatedAt: data.generatedAt || null,
      };
    }

    // 5. Evaluate and Award Badges
    const badges = evaluateBadges(streak, totalSessions, logs);

    return {
      streak: {
        current: streak.currentStreak || 0,
        longest: streak.longestStreak || 0,
        totalDays: streak.totalDays || 0,
      },
      sessions: {
        total: totalSessions,
        thisWeek: sessionsThisWeek,
      },
      topEmotion,
      insight,
      badges,
    };
  } catch (error) {
    console.error('[STATS AGGREGATOR] Failed to build unified stats:', error.message);
    return {
      streak: { current: 0, longest: 0, totalDays: 0 },
      sessions: { total: 0, thisWeek: 0 },
      topEmotion: 'calm',
      insight: null,
      badges: [],
    };
  }
}

/**
 * Badge evaluation helper logic.
 */
function evaluateBadges(streak, totalSessions, logs) {
  const badges = [];

  // First session badge
  if (totalSessions >= 1) {
    badges.push('first-session');
  }

  // Streak badges
  const currentStreak = streak.currentStreak || 0;
  if (currentStreak >= 3) {
    badges.push('3-day-streak');
  }
  if (currentStreak >= 7) {
    badges.push('7-day-streak');
  }

  // Reflection consistency badges
  const totalDays = streak.totalDays || 0;
  if (totalDays >= 30) {
    badges.push('reflection-master');
  }

  // Mood mindfulness badge
  if (logs && logs.length >= 5) {
    badges.push('mood-mindful');
  }

  return badges;
}
