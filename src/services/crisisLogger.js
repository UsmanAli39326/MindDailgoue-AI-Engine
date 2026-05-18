import admin from '../config/firebase.js';

/**
 * Logs a crisis event to Firestore.
 * This is a write-only operation for auditing and safety tracking.
 * Message content is deliberately NOT stored here to protect user privacy.
 * 
 * @param {string} uid - The Firebase Auth User ID
 * @param {string} sessionId - The current chat session ID
 * @param {string} detectedBy - Source of detection: 'ai' or 'keyword'
 */
export async function logCrisisEvent(uid, sessionId, detectedBy) {
  if (!uid || !sessionId) {
    console.warn('[CRISIS LOGGER] Missing uid or sessionId. Cannot log event.');
    return;
  }

  try {
    const db = admin.firestore();
    const timestamp = new Date();
    
    await db.collection('crisisLog')
      .doc(uid)
      .collection('events')
      .add({
        timestamp,
        sessionId,
        detectedBy,
        resolved: false
      });
      
    console.log(`[CRISIS LOGGER] Crisis event logged for user ${uid} in session ${sessionId} (Detected by: ${detectedBy})`);
  } catch (error) {
    console.error('[CRISIS LOGGER] Failed to log crisis event to Firestore:', error);
  }
}
