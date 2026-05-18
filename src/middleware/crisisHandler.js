import { logCrisisEvent } from '../services/crisisLogger.js';
import { CRISIS_RESOURCES } from '../config/crisisResources.js';
import { db } from '../config/firebase.js';

// In-memory cooldown store mapping uid -> timestamp
const sessionCooldowns = new Map();
const COOLDOWN_MS = 60 * 1000; // 60 seconds

/**
 * Post-AI middleware to handle crisis scenarios based on LLM evaluation.
 * @param {Object} envelope - The parsed JSON response envelope from the LLM
 * @param {Object} context - Context object containing { uid, sessionId, scannerCategory, isHighRisk }
 * @returns {Object} - The potentially augmented envelope
 */
export async function handleCrisis(envelope, context) {
  const { uid, sessionId, scannerCategory, isHighRisk } = context;
  
  if (envelope.crisis === true || isHighRisk === true) {
    // 1. Log the crisis event
    const source = envelope.crisis === true ? 'ai' : 'scanner_fallback';
    await logCrisisEvent(uid, sessionId, source);
    
    // 2. Apply cooldown
    if (uid) {
      sessionCooldowns.set(uid, Date.now());
    }
    
    // 3. Augment the response with resources
    const category = scannerCategory || 'suicide'; // default fallback
    let resources = [...(CRISIS_RESOURCES[category] || CRISIS_RESOURCES['suicide'])];
    
    // Dynamic Specialized Clinical Doctor Routing
    if (db) {
      try {
        const doctorsSnap = await db.collection('clinical_doctors')
          .where('specialties', 'array-contains', category)
          .limit(1)
          .get();

        if (!doctorsSnap.empty) {
          const doctorData = doctorsSnap.docs[0].data();
          resources = [
            {
              name: `SPECIALIST ON CALL: ${doctorData.name} (${doctorData.role})`,
              number: doctorData.phone || "",
              url: doctorData.clinicUrl || "",
              isClinicalStaff: true,
              specialty: category
            },
            ...resources
          ];
        }
      } catch (error) {
        console.error('[CRISIS HANDLER] Error matching specialized doctor:', error.message);
      }
    }
    
    return {
      ...envelope,
      crisis: true,
      crisis_mode: true,
      resources
    };
  }
  
  return envelope;
}

/**
 * Checks if a user is currently under a crisis cooldown.
 * @param {string} uid
 * @returns {boolean}
 */
export function isUserInCooldown(uid) {
  if (!uid) return false;
  const lastCrisisTime = sessionCooldowns.get(uid);
  if (!lastCrisisTime) return false;
  
  if (Date.now() - lastCrisisTime < COOLDOWN_MS) {
    return true;
  }
  
  // Clean up expired cooldown
  sessionCooldowns.delete(uid);
  return false;
}
