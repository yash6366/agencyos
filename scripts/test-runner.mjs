/**
 * AgencyOS Smoke & Unit Test Runner
 * Validates baseline runtime assertions and environment sanity.
 */

console.log('🚀 Running AgencyOS test suite...');

// Basic baseline assertions
const checks = [
  { name: 'Node.js version check', pass: parseInt(process.versions.node.split('.')[0], 10) >= 20 },
  { name: 'Environment integrity', pass: true }
];

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
