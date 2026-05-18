import { auth } from '../config/firebase.js';

/**
 * Middleware to verify Firebase Auth JWT tokens.
 * Attach the user UID to the request object if valid.
 */
export const verifyToken = async (req, res, next) => {
  // Bypass for health check
  if (req.path === '/' || req.path === '/health') {
    return next();
  }

  const authHeader = req.headers.authorization;

  // Development mode bypass (only if no token provided or token is dummy)
  if (process.env.NODE_ENV === 'development' && (!authHeader || authHeader === 'Bearer dev-user-123')) {
    console.log('🧪 Auth: Development mode enabled (no real token provided). Using mock user.');
    req.user = { uid: 'dev-user-123' };
    return next();
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    if (!auth) {
      throw new Error('Firebase Admin not initialized');
    }

    const decodedToken = await auth.verifyIdToken(token);
    req.user = { uid: decodedToken.uid };
    next();
  } catch (error) {
    console.error('❌ Auth Error:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
