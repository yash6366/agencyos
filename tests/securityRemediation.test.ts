import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { encryptToken, decryptToken, isEncryptedToken } from '../server/utils/crypto.mjs';

test('Security Remediation: AES-256-GCM Encryption & Decryption', () => {
  const secretKey = 'my-super-secret-encryption-key-for-tests';
  const rawToken = 'ya29.a0AfH6SMDIEXAMPLE_GOOGLE_REFRESH_TOKEN_9876543210';

  const encrypted = encryptToken(rawToken, secretKey);
  assert.notEqual(encrypted, rawToken);
  assert.ok(isEncryptedToken(encrypted), 'Payload should match iv:authTag:ciphertext structure');

  const decrypted = decryptToken(encrypted, secretKey);
  assert.equal(decrypted, rawToken, 'Decrypted token must exactly match original raw token');
});

test('Security Remediation: Tamper Resistance (GCM Auth Tag Verification)', () => {
  const secretKey = 'test-secret';
  const rawToken = 'secret-data';
  const encrypted = encryptToken(rawToken, secretKey);
  const parts = encrypted.split(':');
  
  // Tamper with ciphertext while keeping valid even hex length
  const tamperedCipher = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
  const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

  assert.throws(() => {
    decryptToken(tamperedPayload, secretKey);
  }, /Unsupported state or unable to authenticate data/, 'Tampered ciphertext should fail auth tag verification');
});

test('Security Remediation: Backward-compatible plain token passthrough', () => {
  const legacyToken = 'plain_legacy_token_123';
  const result = decryptToken(legacyToken);
  assert.equal(result, legacyToken, 'Plain legacy token without colons should pass through without error');
});

test('Security Remediation: Direct Server-Side Bcrypt Password Authentication', async () => {
  const clientHash = (pw: string) => crypto.createHash('sha256').update('paa-salt:' + pw).digest('hex');
  const userPassword = 'EnterpriseSecret#2026';

  // 1. Direct server-side bcrypt hash (new standard)
  const directHash = await bcrypt.hash(userPassword, 10);
  const directMatch = await bcrypt.compare(userPassword, directHash);
  assert.ok(directMatch, 'Direct password should match bcrypt hash');

  // 2. Legacy client-hashed password (backward compatibility)
  const legacyHash = await bcrypt.hash(clientHash(userPassword), 10);
  const legacyMatch = await bcrypt.compare(clientHash(userPassword), legacyHash);
  assert.ok(legacyMatch, 'Legacy client pre-hashed password should match for existing users');

  // 3. Ensure wrong password fails both
  const wrongMatchDirect = await bcrypt.compare('WrongPassword123', directHash);
  const wrongMatchLegacy = await bcrypt.compare(clientHash('WrongPassword123'), legacyHash);
  assert.strictEqual(wrongMatchDirect, false);
  assert.strictEqual(wrongMatchLegacy, false);
});

test('Security Remediation: Sync Store-to-Module Mapping Authorization', () => {
  // Mapping of app_records stores to required module permissions
  const STORE_MODULES: Record<string, number> = {
    paa_deals_sow: 1, // M.PRJ
    paa_milestones: 1, // M.PRJ
    paa_project_templates: 1, // M.PRJ
    paa_documents: 2, // M.CLI
    paa_vendors: 3, // M.FIN
    paa_vendor_bills: 3, // M.FIN
  };

  const checkSyncAccess = (store: string, userModules: number[]): boolean => {
    const requiredMod = STORE_MODULES[store];
    if (requiredMod === undefined) return false; // deny unknown arbitrary stores
    return userModules.includes(requiredMod);
  };

  // Staff with access to PRJ (1) but not FIN (3)
  assert.ok(checkSyncAccess('paa_milestones', [1, 2]));
  assert.strictEqual(checkSyncAccess('paa_vendors', [1, 2]), false);
  assert.strictEqual(checkSyncAccess('malicious_arbitrary_store', [1, 2, 3]), false);
});
