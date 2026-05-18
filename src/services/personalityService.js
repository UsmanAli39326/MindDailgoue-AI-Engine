import { db } from '../config/firebase.js';

const COLLECTION = 'personalities';

/**
 * Service to manage AI personalities in Firestore.
 */
export const personalityService = {
  /**
   * Get all personalities.
   */
  async getAll() {
    if (!db) return [];
    
    try {
      const snapshot = await db.collection(COLLECTION).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('❌ Error fetching personalities:', error);
      return [];
    }
  },

  /**
   * Get a personality by ID.
   */
  async getById(id) {
    if (!db) return null;

    try {
      const doc = await db.collection(COLLECTION).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data() } : null;
    } catch (error) {
      console.error(`❌ Error fetching personality ${id}:`, error);
      return null;
    }
  },

  /**
   * Create or update a personality.
   */
  async save(id, data) {
    if (!db) return null;

    try {
      await db.collection(COLLECTION).doc(id).set(data, { merge: true });
      return { id, ...data };
    } catch (error) {
      console.error(`❌ Error saving personality ${id}:`, error);
      return null;
    }
  },

  /**
   * Get all custom private personalities for a user.
   */
  async getUserCustomAll(uid) {
    if (!db || !uid) return [];
    try {
      const snapshot = await db.collection('users').doc(uid).collection(COLLECTION).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPrivate: true }));
    } catch (error) {
      console.error(`❌ Error fetching custom personalities for user ${uid}:`, error.message);
      return [];
    }
  },

  /**
   * Get a custom private personality by ID for a user.
   */
  async getUserCustomById(uid, id) {
    if (!db || !uid || !id) return null;
    try {
      const doc = await db.collection('users').doc(uid).collection(COLLECTION).doc(id).get();
      return doc.exists ? { id: doc.id, ...doc.data(), isPrivate: true } : null;
    } catch (error) {
      console.error(`❌ Error fetching custom personality ${id} for user ${uid}:`, error.message);
      return null;
    }
  },

  /**
   * Save/create a custom private personality for a user.
   */
  async saveUserCustom(uid, id, data) {
    if (!db || !uid || !id) return null;
    try {
      await db.collection('users').doc(uid).collection(COLLECTION).doc(id).set(data, { merge: true });
      return { id, ...data, isPrivate: true };
    } catch (error) {
      console.error(`❌ Error saving custom personality ${id} for user ${uid}:`, error.message);
      return null;
    }
  }
};
