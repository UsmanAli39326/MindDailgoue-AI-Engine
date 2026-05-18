// ─────────────────────────────────────────────────────────────
// generateDailyInsight.js
// Scheduled Cloud Function (daily at 00:05 UTC).
// Reads last 7 days of mood data, generates an empathetic
// AI insight, and writes to /users/{uid}/insights/latest.
// ─────────────────────────────────────────────────────────────

import { db } from '../src/config/firebase.js';
import { callLLM } from '../src/llmClient.js';
import { buildSummary } from '../src/services/moodAggregation.js';

/**
 * Generate a daily insight for a single user.
 * @param {string} uid
 * @returns {Promise<Object|null>}
 */
export async function generateInsightForUser(uid) {
  if (!uid || !db) return null;

  try {
    // 1. Fetch last 7 days of mood logs
    const logs = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      const doc = await db.collection('users').doc(uid).collection('moodLog').doc(dateStr).get();
      if (doc.exists) {
        logs.push({ date: dateStr, ...doc.data() });
      }
    }

    if (logs.length === 0) {
      console.log(`[INSIGHT] No mood data for user ${uid}. Skipping.`);
      return null;
    }

    // 2. Build summary
    const summary = buildSummary(logs);

    // 3. Construct insight prompt
    const insightPrompt = buildInsightPrompt(summary);

    // 4. Call LLM
    let llmResult;
    try {
      llmResult = await callLLM({ prompt: insightPrompt, temperature: 0.8 });
    } catch (err) {
      console.error(`[INSIGHT] LLM call failed for user ${uid}:`, err.message);
      return null;
    }

    // 5. Parse and store
    const insight = parseInsightResponse(llmResult.text, summary);

    await db.collection('users').doc(uid).collection('insights').doc('latest').set(insight);

    console.log(`[INSIGHT] Generated insight for user ${uid}: dominant=${insight.dominant_emotion}`);
    return insight;
  } catch (error) {
    console.error(`[INSIGHT] Failed to generate insight for user ${uid}:`, error.message);
    return null;
  }
}

/**
 * Run insight generation for all active users.
 * In production, this would be triggered by a Cloud Function scheduler.
 */
export async function generateDailyInsights() {
  if (!db) {
    console.warn('[INSIGHT] Firestore not available. Cannot generate insights.');
    return;
  }

  try {
    // Get all users who have mood data in the last 7 days
    const usersSnapshot = await db.collection('users').listDocuments();

    let generated = 0;
    for (const userDoc of usersSnapshot) {
      const result = await generateInsightForUser(userDoc.id);
      if (result) generated++;
    }

    console.log(`[INSIGHT] Daily insights generated for ${generated} users.`);
  } catch (error) {
    console.error('[INSIGHT] Daily insight batch failed:', error.message);
  }
}

// ─── Internal Helpers ────────────────────────────────────────

function buildInsightPrompt(summary) {
  return `You are a compassionate mental health companion reviewing a user's emotional week.

Here is their mood summary for the past 7 days:
- Total check-ins: ${summary.total_entries}
- Dominant emotion: ${summary.dominant_emotion}
- Average intensity: ${summary.avg_intensity}
- Average stress: ${summary.avg_stress}
- Emotion breakdown: ${JSON.stringify(summary.emotions)}

Please respond in JSON format:
{
  "insight": "A warm, empathetic 2-3 sentence reflection on their emotional week. Be specific about patterns you notice.",
  "prompt": "A short, inspiring question or reflection prompt for today (1 sentence)."
}

Rules:
- Be warm, never clinical or judgmental.
- Reference specific emotions from the data.
- Keep the insight under 80 words.
- Keep the prompt under 25 words.`;
}

function parseInsightResponse(rawText, summary) {
  const generatedAt = new Date().toISOString();
  const base = {
    dominant_emotion: summary.dominant_emotion,
    generatedAt,
    total_entries: summary.total_entries,
  };

  try {
    // Strip markdown fences if present
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    return {
      ...base,
      insight: parsed.insight || 'Your emotional journey this week shows real growth. Keep going.',
      prompt: parsed.prompt || 'What moment this week made you feel most like yourself?',
    };
  } catch {
    // Fallback: use raw text as insight
    return {
      ...base,
      insight: rawText.slice(0, 300).trim() || 'Your emotional journey this week shows real growth. Keep going.',
      prompt: 'What moment this week made you feel most like yourself?',
    };
  }
}

export const _internals = {
  buildInsightPrompt,
  parseInsightResponse,
};
