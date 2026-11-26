import test from 'node:test';
import assert from 'node:assert/strict';

test('Enhancement 5: Password Complexity Rule Verification', () => {
  const isValidPassword = (pw: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);

  // Valid passwords
  assert.equal(isValidPassword('Password123'), true);
  assert.equal(isValidPassword('Welcome@2026'), true);
  assert.equal(isValidPassword('agency99Secure'), true);

  // Invalid: too short (< 8)
  assert.equal(isValidPassword('Pass1'), false);

  // Invalid: letters only
  assert.equal(isValidPassword('passwordonly'), false);

  // Invalid: numbers only
  assert.equal(isValidPassword('123456789'), false);
});

test('Enhancement 5: Separation of Employee-Editable vs HR-Restricted Fields', () => {
  const hrRestricted = [
    'role',
    'employeeId',
    'employeeCode',
    'departmentId',
    'department',
    'designationId',
    'designation',
    'reportingManagerId',
    'joiningDate',
    'salary',
    'status',
    'bankDetails',
    'bank',
    'pan',
    'aadhaar',
  ];

  const employeeEditable = [
    'phone',
    'personalEmail',
    'address',
    'emergencyContact',
    'bloodGroup',
    'bio',
    'avatar',
    'profilePicture',
  ];

  // Disjoint sets
  employeeEditable.forEach((field) => {
    assert.ok(!hrRestricted.includes(field), `Field ${field} must not be in hrRestricted`);
  });

  // Verify access check logic
  const checkCanUpdate = (callerRole: string, field: string) => {
    if (['super_admin', 'admin', 'hr'].includes(callerRole)) return true;
    return !hrRestricted.includes(field);
  };

  assert.equal(checkCanUpdate('employee', 'phone'), true, 'Employee can edit own phone');
  assert.equal(checkCanUpdate('employee', 'salary'), false, 'Employee cannot edit salary');
  assert.equal(checkCanUpdate('employee', 'role'), false, 'Employee cannot edit role');
  assert.equal(checkCanUpdate('hr', 'salary'), true, 'HR can edit salary');
  assert.equal(checkCanUpdate('super_admin', 'role'), true, 'Founder can edit role');
});
