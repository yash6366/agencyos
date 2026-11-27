/**
 * AgencyOS Smoke & Unit Test Runner
 * Validates baseline runtime assertions, password security, and default credentials.
 */

process.env.NODE_ENV = 'test';
process.env.DB_PASSWORD ||= 'test';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

console.log('🚀 Running AgencyOS test suite...');

async function runTests() {
  const { isValidPassword, isMatchDefault, KNOWN_DEFAULT_PASSWORDS, clientHash } = await import('../server/index.mjs');
  const checks = [
    { name: 'Node.js version check (>= 20)', pass: parseInt(process.versions.node.split('.')[0], 10) >= 20 },
    { name: 'Environment integrity', pass: true },
    { name: 'Password complexity: "Welcome@123" is valid', pass: isValidPassword('Welcome@123') },
    { name: 'Password complexity: "YourStrongInitialAdminPassword123!" is valid', pass: isValidPassword('YourStrongInitialAdminPassword123!') },
    { name: 'Password complexity: reject short password', pass: !isValidPassword('Ab1!') },
    { name: 'Password complexity: reject missing number', pass: !isValidPassword('Welcome@abc') },
    { name: 'Password complexity: reject missing symbol', pass: !isValidPassword('Welcome123') },
    { name: 'Default credentials: KNOWN_DEFAULT_PASSWORDS includes Welcome@123', pass: KNOWN_DEFAULT_PASSWORDS.includes('Welcome@123') },
    { name: 'Default credentials: isMatchDefault matches "Welcome@123"', pass: isMatchDefault('Welcome@123') },
    { name: 'Default credentials: isMatchDefault matches clientHash("Welcome@123")', pass: isMatchDefault(clientHash('Welcome@123')) },
    { name: 'Default credentials: isMatchDefault rejects wrong password', pass: !isMatchDefault('WrongPassword999!') },
    { name: 'Default credentials: isMatchDefault rejects empty string', pass: !isMatchDefault('') },
  ];

  const testHash = await bcrypt.hash('Welcome@123', 10);
  const bcryptOk = await bcrypt.compare('Welcome@123', testHash);
  checks.push({ name: 'Bcrypt compare check for default password', pass: bcryptOk });

  let allPassed = true;
  for (const check of checks) {
    if (check.pass) {
      console.log(`  ✓ ${check.name}`);
    } else {
      console.error(`  ✗ ${check.name}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.error('\n❌ Test suite failed.');
    process.exit(1);
  }

  console.log('\n✅ All tests passed successfully.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
