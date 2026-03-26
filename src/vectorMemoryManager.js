// ─────────────────────────────────────────────────────────────
// vectorMemoryManager.js
// In-memory vector database simulation using Ollama embeddings.
// Enforces hard caps, deduplication, and similarity thresholds
// to prevent memory explosion and degradation over time.
// ─────────────────────────────────────────────────────────────

// ─── Configuration ──────────────────────────────────────────

const OLLAMA_BASE_URL = 'http://localhost:11434';
const EMBED_ENDPOINT = '/api/embeddings';

// CONSTRAINT: Must use nomic-embed-text for high quality embeddings
const EMBED_MODEL = 'nomic-embed-text';

// CONSTRAINT: Hard cap to keep performance stable
const MAX_MEMORIES_PER_SESSION = 200;

// CONSTRAINT: Strict deduplication threshold
const DEDUPLICATION_THRESHOLD = 0.90;

// CONSTRAINT: Adjusted retrieval threshold for better therapeutic recall
const RETRIEVAL_THRESHOLD = 0.55;

// ─── Store ──────────────────────────────────────────────────
// Map<sessionId, Array<{ text, embedding, metadata, timestamp }>>
const memoryStore = new Map();

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Call Ollama to get an embedding vector.
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}${EMBED_ENDPOINT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error('Invalid embedding format received.');
    }

    return data.embedding;
  } catch (err) {
    throw new Error(`Failed to generate embedding with ${EMBED_MODEL}: ${err.message}`);
  }
}

/**
 * Compute cosine similarity between two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} — similarity score between -1 and 1
 */
function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Store a new memory, adhering to deduplication and capacity constraints.
 *
 * @param {string} sessionId
 * @param {string} text
 * @param {Object} metadata
 * @returns {Promise<boolean>} — true if stored, false if deduplicated/skipped
 */
export async function storeMemory(sessionId, text, metadata = {}) {
  if (!text || text.trim().length === 0) return false;

  const embedding = await getEmbedding(text);

  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, []);
  }
  const sessionMemories = memoryStore.get(sessionId);

  // CONSTRAINT: Memory Deduplication
  for (const existing of sessionMemories) {
    const sim = cosineSimilarity(embedding, existing.embedding);
    if (sim > DEDUPLICATION_THRESHOLD) {
      // Memory already exists (semantically), update timestamp but don't duplicate
      existing.timestamp = new Date().toISOString();
      return false; // deduplicated
    }
  }

  // Store new memory
  sessionMemories.push({
    text,
    embedding,
    metadata: {
      ...metadata,
      importance: metadata.importance || 'medium'
    },
    timestamp: new Date().toISOString()
  });

  // CONSTRAINT: Hard cap per session to prevent explosion
  if (sessionMemories.length > MAX_MEMORIES_PER_SESSION) {
    memoryStore.set(sessionId, sessionMemories.slice(-MAX_MEMORIES_PER_SESSION));
  }

  return true;
}

/**
 * Retrieve relevant memories based on semantic similarity.
 *
 * @param {string} sessionId
 * @param {string} query
 * @param {number} topK
 * @returns {Promise<Array<{ text: string, similarity: number, metadata: Object }>>}
 */
export async function retrieveRelevantMemories(sessionId, query, topK = 3) {
  if (!memoryStore.has(sessionId)) return [];
  const sessionMemories = memoryStore.get(sessionId);
  if (sessionMemories.length === 0) return [];

  const queryEmbedding = await getEmbedding(query);
  const results = [];

  for (const memory of sessionMemories) {
    const sim = cosineSimilarity(queryEmbedding, memory.embedding);

    // CONSTRAINT: Missing Similarity Threshold (reject low relevance)
    if (sim >= RETRIEVAL_THRESHOLD) {
      results.push({
        text: memory.text,
        similarity: sim,
        metadata: memory.metadata,
        timestamp: memory.timestamp
      });
    }
  }

  // Sort by highest similarity first, then slice top K
  results.sort((a, b) => b.similarity - a.similarity);
  return results.slice(0, topK);
}

/**
 * Clear vector store for testing.
 */
export function clearAll() {
  memoryStore.clear();
}

// Export internal functions for testing only
export const _internals = {
  cosineSimilarity,
  getEmbedding,
  MAX_MEMORIES_PER_SESSION,
  DEDUPLICATION_THRESHOLD,
  RETRIEVAL_THRESHOLD,
  memoryStore
};
