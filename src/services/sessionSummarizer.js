// ─────────────────────────────────────────────────────────────
// sessionSummarizer.js
// Summarizes session conversations and persists to Firestore.
// Triggers after every 10 messages or on session close.
// ─────────────────────────────────────────────────────────────

import { db } from '../config/firebase.js';
import { callLLM } from '../llmClient.js';
import { encrypt } from './encryptionService.js';

const SUMMARIZE_THRESHOLD = 10;

/**
 * Summarize the last N messages and store in Firestore.
 * @param {string} uid - Firebase Auth user ID
 * @param {string} sessionId
 * @param {string[]} messages - Recent history lines ("User: ...", "Assistant: ...")
 * @returns {Promise<Object|null>} The stored summary document, or null on failure
 */
export async function summarizeAndStore(uid, sessionId, messages) {
  if (!uid || !sessionId || !messages || messages.length === 0) return null;
  if (!db) {
    console.warn('[SUMMARIZER] Firestore not available. Skipping.');
    return null;
  }

  try {
    // 1. Build summarization prompt
    const conversationText = messages.slice(-SUMMARIZE_THRESHOLD).join('\n');
    const prompt = buildSummarizationPrompt(conversationText);

    // 2. Call LLM for summary
    let llmResult;
    try {
      llmResult = await callLLM({ prompt, temperature: 0.3 });
    } catch (err) {
      console.error('[SUMMARIZER] LLM call failed:', err.message);
      // Fallback: truncate conversation as summary
      return await storeSummary(uid, sessionId, messages, {
        summary: conversationText.slice(0, 300),
        themes: [],
      });
    }

    // 3. Parse response
    const parsed = parseSummaryResponse(llmResult.text);

    // 4. Store in Firestore
    return await storeSummary(uid, sessionId, messages, parsed);
  } catch (error) {
    console.error('[SUMMARIZER] Failed:', error.message);
    return null;
  }
}

/**
 * Check if a session has reached the summarization threshold.
 * @param {number} messageCount
 * @returns {boolean}
 */
export function shouldSummarize(messageCount) {
  return messageCount > 0 && messageCount % SUMMARIZE_THRESHOLD === 0;
}

// ─── Internal Helpers ────────────────────────────────────────

async function storeSummary(uid, sessionId, messages, parsed) {
  let finalSummary = parsed.summary;
  let summaryIv = null;

  try {
    const encrypted = encrypt(parsed.summary);
    finalSummary = encrypted.ciphertext;
    summaryIv = encrypted.iv;
  } catch (err) {
    console.error('[SUMMARIZER] Summary encryption failed:', err.message);
  }

  const doc = {
    summary: finalSummary,
    ...(summaryIv ? { iv: summaryIv } : {}),
    themes: parsed.themes || [],
    createdAt: new Date().toISOString(),
    sessionId,
    messageRange: {
      count: Math.min(messages.length, SUMMARIZE_THRESHOLD),
      lastIndex: messages.length,
    },
  };

  const ref = await db.collection('users').doc(uid).collection('memory').add(doc);
  console.log(`[SUMMARIZER] Stored summary ${ref.id} for session ${sessionId}`);
  return { id: ref.id, ...doc, summary: parsed.summary };
}

function buildSummarizationPrompt(conversationText) {
  return `You are a clinical note-taker for a therapy-style conversation.
Summarize the following conversation in 2-3 sentences (max 150 tokens).
Also extract up to 5 emotional/topical themes as a JSON array.

Conversation:
${conversationText}

Respond in JSON format:
{
  "summary": "...",
  "themes": ["theme1", "theme2"]
}`;
}

function parseSummaryResponse(rawText) {
  try {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    }
    const parsed = JSON.parse(cleaned);
    return {
      summary: parsed.summary || cleaned.slice(0, 300),
      themes: Array.isArray(parsed.themes) ? parsed.themes.slice(0, 5) : [],
    };
  } catch {
    return {
      summary: rawText.slice(0, 300).trim(),
      themes: [],
    };
  }
}

export const _internals = {
  SUMMARIZE_THRESHOLD,
  buildSummarizationPrompt,
  parseSummaryResponse,
  storeSummary,
};
