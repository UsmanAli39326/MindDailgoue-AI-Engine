import { db } from '../config/firebase.js';

export async function getUserBasicInfo(uid) {
  if (!uid || !db) return null;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      return {
        name: data.name || null,
        background: data.background || null
      };
    }
  } catch (error) {
    console.error('[USER SERVICE] Failed to fetch basic info:', error.message);
  }
  return null;
}

export async function updateLastActive(uid) {
  if (!uid || !db) return;
  try {
    await db.collection('users').doc(uid).set({
      lastActiveAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('[USER SERVICE] Failed to update lastActiveAt:', error.message);
  }
}

export async function markCheckinSent(uid) {
  if (!uid || !db) return;
  try {
    await db.collection('users').doc(uid).set({
      lastCheckinAt: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.error('[USER SERVICE] Failed to mark checkin sent:', error.message);
  }
}
