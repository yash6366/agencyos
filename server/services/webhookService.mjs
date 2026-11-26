// Webhook Security & Verification Service for AgencyOS
// Implements HMAC-SHA256 signature verification for Meta/WhatsApp & third-party webhooks

import crypto from 'crypto';

/**
 * Verifies the HMAC-SHA256 signature sent in the X-Hub-Signature-256 header.
 * @param {string | Buffer} payload Raw request payload
 * @param {string} signature Header value, e.g. "sha256=abcdef..."
 * @param {string} secret Secret configured with webhook provider
 * @returns {boolean} True if signature is valid
 */
export function verifyMetaWebhookSignature(payload, signature, secret) {
  if (!payload || !signature || !secret) return false;
  
  const cleanSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  const expectedHash = crypto
    .createHmac('sha256', secret)
    .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
    .digest('hex');

  // Use timingSafeEqual to protect against timing attacks
  const signatureBuffer = Buffer.from(cleanSignature, 'hex');
  const expectedBuffer = Buffer.from(expectedHash, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}
