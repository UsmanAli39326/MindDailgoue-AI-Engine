// ─────────────────────────────────────────────────────────────
// requestLogger.js
// Structured JSON middleware to log HTTP traffic.
// Hashes sensitive UIDs for GDPR and HIPAA compliance.
// ─────────────────────────────────────────────────────────────

import crypto from 'crypto';

/**
 * Hash a user ID using SHA-256 for privacy.
 * @param {string} uid
 * @returns {string}
 */
function hashUid(uid) {
  if (!uid) return 'anonymous';
  return crypto.createHash('sha256').update(uid).digest('hex').slice(0, 16);
}

/**
 * Structured JSON Logger Middleware.
 */
export function requestLogger(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationMs = Math.round((diff[0] * 1e3 + diff[1] * 1e-6) * 100) / 100;

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: (req.baseUrl || '') + req.path,
      statusCode: res.statusCode,
      durationMs,
      uidHash: req.user?.uid ? hashUid(req.user.uid) : 'anonymous',
      userAgent: req.get('User-Agent') || 'unknown',
    };

    // Output strictly as a structured JSON string
    console.log(JSON.stringify(logEntry));
  });

  next();
}
export default requestLogger;
