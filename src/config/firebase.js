import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}
dotenv.config();

let serviceAccount;

// Production: read from Render secret file
if (fs.existsSync('/etc/secrets/firebase.json')) {
  try {
    serviceAccount = JSON.parse(fs.readFileSync('/etc/secrets/firebase.json', 'utf8'));
    console.log('✅ Loaded Firebase credentials from secret file.');
  } catch (error) {
    console.error('❌ Failed to read firebase.json secret file:', error.message);
  }
} else {
  // Development: read from environment variables
  serviceAccount = {
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
}

if (!serviceAccount?.project_id || !serviceAccount?.client_email || !serviceAccount?.private_key) {
  console.warn('⚠️ Firebase credentials missing. Firestore and Auth features will be disabled.');
} else {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized successfully.');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
  }
}

export const db = admin.apps.length ? admin.firestore() : null;
export const auth = admin.apps.length ? admin.auth() : null;
export const adminApp = admin.apps.length ? admin.apps[0] : null;

export default admin;