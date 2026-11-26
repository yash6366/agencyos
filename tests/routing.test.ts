import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBreadcrumbs, registerDirtyForm, hasUnsavedChanges } from '../src/lib/router.ts';

test('Enhancement 2: Dynamic Breadcrumbs Generation', () => {
  // Test Level 1: Page in Workspace
  const b1 = buildBreadcrumbs('founder');
  assert.equal(b1[0].label, 'Workspace');
  assert.equal(b1[b1.length - 1].label, 'Founder Command Center');

  // Test Level 2: Hub Page (e.g. leads in CRM & Sales)
  const b2 = buildBreadcrumbs('leads');
  assert.equal(b2[0].label, 'CRM & Sales');
  assert.ok(b2.some((c) => c.label === 'Leads' || c.label === 'All Leads'));

  // Test Level 3: Nested record detail
  const b3 = buildBreadcrumbs('lead-profile', { id: 'lead-123', name: 'Acme Corp' });
  assert.equal(b3[0].label, 'CRM & Sales');
  assert.equal(b3[b3.length - 1].label, 'Acme Corp');
  assert.equal(b3[b3.length - 1].isCurrent, true);
});

test('Enhancement 2: Unsaved Form Changes Protection', () => {
  // Initially clean
  assert.equal(hasUnsavedChanges().dirty, false);

  // Register dirty form
  registerDirtyForm('client-edit-form', true, 'Client record modified. Discard changes?');
  const checkDirty = hasUnsavedChanges();
  assert.equal(checkDirty.dirty, true);
  assert.equal(checkDirty.message, 'Client record modified. Discard changes?');

  // Clear dirty form
  registerDirtyForm('client-edit-form', false);
  assert.equal(hasUnsavedChanges().dirty, false);
});
