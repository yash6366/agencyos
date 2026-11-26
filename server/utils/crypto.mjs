// Cryptographic utility for AgencyOS (AES-256-GCM token encryption & secure hashing)
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM

/**
 * Derives a 32-byte key from the configured encryption secret or JWT secret.
 * @param {string} [secret]
 * @returns {Buffer}
 */
export function deriveKey(secret) {
  const keyMaterial = secret || process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'agencyos-secure-fallback-encryption-key-32b';
  return crypto.createHash('sha256').update(String(keyMaterial)).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * @param {string} plaintext
 * @param {string} [customSecret]
 * @returns {string} Encrypted format: "iv:authTag:ciphertext" (hex encoded)
 */
export function encryptToken(plaintext, customSecret) {
  if (!plaintext) return '';
  const key = deriveKey(customSecret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(String(plaintext), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a ciphertext string produced by encryptToken.
 * @param {string} encryptedPayload Format: "iv:authTag:ciphertext"
 * @param {string} [customSecret]
 * @returns {string} Plaintext string
 */
export function decryptToken(encryptedPayload, customSecret) {
  if (!encryptedPayload) return '';
  // Check if payload is in the expected iv:authTag:ciphertext format
  const parts = String(encryptedPayload).split(':');
  if (parts.length !== 3) {
    // If not encrypted format, return as-is for backward compatibility during migration
    return encryptedPayload;
  }
  
  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = deriveKey(customSecret);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Checks if a string looks like an encrypted token payload.
 * @param {string} val
 * @returns {boolean}
 */
export function isEncryptedToken(val) {
  if (typeof val !== 'string') return false;
  const parts = val.split(':');
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}
