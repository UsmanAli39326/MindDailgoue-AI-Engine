import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard IV length for GCM

// Retrieve key from environment, or use a hardcoded dev key if missing.
const rawKey = process.env.DB_ENCRYPTION_KEY || 'dev-secret-key-32-bytes-minddia';
// Derive a 32-byte key using sha256 to ensure it is exactly 32 bytes
const KEY = crypto.createHash('sha256').update(rawKey).digest();

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns { ciphertext: string (hex:authTagHex), iv: string (hex) }
 */
export function encrypt(text) {
  if (typeof text !== 'string') {
    throw new Error('Payload must be a string to encrypt');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Package ciphertext and authTag together (separated by a colon)
  const completeCiphertext = `${encrypted}:${authTag}`;
  
  return {
    ciphertext: completeCiphertext,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypt a ciphertext and IV using AES-256-GCM.
 * Returns the decrypted plaintext string.
 */
export function decrypt(ciphertext, ivHex) {
  if (!ciphertext || !ivHex) {
    throw new Error('Ciphertext and IV are required for decryption');
  }

  // Handle transparent bypass for legacy plaintext logs in dev mode
  if (ivHex === 'plaintext') {
    return ciphertext;
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 2) {
    throw new Error('Malformed encrypted payload structure');
  }

  const [encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
