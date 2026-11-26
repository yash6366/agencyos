import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyMetaWebhookSignature } from '../server/services/webhookService.mjs';

test('Webhook Security: Meta / WhatsApp HMAC-SHA256 Signature Verification', () => {
  const secret = 'meta_app_secret_agencyos_webhook_key_2026';
  const payload = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{ value: { messages: [{ from: '919876543210', text: { body: 'Hello AgencyOS' } }] }, field: 'messages' }],
      },
    ],
  });

  const validHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const validHeader = `sha256=${validHmac}`;

  // 1. Valid signature check
  assert.ok(
    verifyMetaWebhookSignature(payload, validHeader, secret),
    'Valid HMAC signature should pass verification'
  );

  // 2. Tampered payload check
  const tamperedPayload = payload.replace('Hello AgencyOS', 'Malicious Injection');
  assert.strictEqual(
    verifyMetaWebhookSignature(tamperedPayload, validHeader, secret),
    false,
    'Tampered payload should be rejected'
  );

  // 3. Invalid signature check
  const fakeSignature = 'sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  assert.strictEqual(
    verifyMetaWebhookSignature(payload, fakeSignature, secret),
    false,
    'Forged signature should fail verification'
  );
});
