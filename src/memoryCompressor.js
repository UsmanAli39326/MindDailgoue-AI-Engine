// ─────────────────────────────────────────────────────────────
// memoryCompressor.js
// Compresses specific memories to strictly control 
// prompt token usage in Phase 3.
// ─────────────────────────────────────────────────────────────
import { callLLM } from './llmClient.js';

// CONSTRAINT: Summarize memories efficiently 
const MAX_MEMORY_TOKENS = 40;

/**
 * Summarizes a single long memory into a highly condensed fact.
 * @param {string} text 
 * @returns {Promise<string>}
 */
export async function summarizeMemory(text) {
  // If the memory is already very short, skip LLM overhead.
  if (text.length < 150) { 
    return text; 
  }

  const prompt = `Summarize the following personal fact or emotional memory in less than ${MAX_MEMORY_TOKENS} words. Be extremely concise. Keep key names, stress points, and emotions.

TEXT TO SUMMARIZE:
"${text}"

SUMMARY (just the fact, no conversational filler):`;

  try {
    const response = await callLLM({
      prompt,
      // Use system default model (tinyllama) for summarizing
    });
    
    // Strip out quotes or AI filler if any
    let summary = response.text.trim();
    summary = summary.replace(/^"|"$|Summary:|Here is the summary:/gi, '').trim();
    
    return summary;
  } catch (err) {
    // If summarization fails, truncate safely to prevent token explosion
    const safeTruncate = text.slice(0, 150) + '...';
    return safeTruncate;
  }
}
