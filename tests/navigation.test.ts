import test from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, PAGES, ALIASES, osCanAccess } from '../src/os/osConfig.ts';
import { buildNav } from '../src/os/osHubs.tsx';

test('Enhancement 1 & 8: Centralized Navigation - exactly 10 groups in exact order', () => {
  const expectedGroups = [
    'Workspace',
    'CRM & Sales',
    'Clients & Services',
    'Operations',
    'Service Delivery',
    'Finance & Accounts',
    'People & HR',
    'Document Center',
    'Reports',
    'Administration',
  ];

  assert.equal(NAV_GROUPS.length, 10, 'Must have exactly 10 navigation groups');
  expectedGroups.forEach((name, i) => {
    assert.equal(NAV_GROUPS[i].key, name, `Group ${i + 1} must be ${name}`);
  });
});

test('Enhancement 6: Unified Conversations relocated to Workspace as Communication Workspace', () => {
  const commPage = PAGES.find((p) => p.id === 'communication');
  assert.ok(commPage, 'communication page must exist');
  assert.equal(commPage?.group, 'Workspace', 'communication must be in Workspace group');
  assert.equal(commPage?.name, 'Communication Workspace', 'Page name must be Communication Workspace');

  // Verify aliases
  assert.equal(ALIASES['inbox'], 'communication', 'inbox alias must point to communication');
  assert.equal(ALIASES['communication'], 'communication', 'communication alias must resolve to itself');

  // Verify inbox is not present in CRM & Sales group
  const crmPages = PAGES.filter((p) => p.group === 'CRM & Sales');
  assert.ok(!crmPages.some((p) => p.id === 'inbox'), 'inbox must NOT be in CRM & Sales');
});

test('Enhancement 1: Service Delivery group contains proper delivery modules', () => {
  const deliveryPages = PAGES.filter((p) => p.group === 'Service Delivery');
  const ids = deliveryPages.map((p) => p.id);
  assert.ok(ids.includes('creative'), 'Must include creative');
  assert.ok(ids.includes('content-calendar'), 'Must include content-calendar');
  assert.ok(ids.includes('campaigns'), 'Must include campaigns');
  assert.ok(ids.includes('deliverables'), 'Must include deliverables');
  assert.ok(ids.includes('capacity'), 'Must include capacity');
  assert.ok(ids.includes('deals_sow'), 'Must include deals_sow');
  assert.ok(ids.includes('deals_templates'), 'Must include deals_templates');
});

test('Enhancement 1: No duplicate destinations across navigation groups', () => {
  const ids = PAGES.map((p) => p.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, 'Every page id in navigation must be globally unique');
});

test('Enhancement 1: Permission-aware navigation rendering per role', () => {
  const superAdminNav = buildNav('super_admin', '');
  assert.ok(superAdminNav.length >= 8, 'Super admin must see all authorized groups');

  const employeeNav = buildNav('employee', '');
  // Employee must not see founder-only administration screens like Permission Matrix or Backups
  const adminGroup = employeeNav.find((g) => g.key === 'Administration');
  const hasPermissions = adminGroup?.pages.some((p) => p.id === 'permissions');
  const hasBackups = adminGroup?.pages.some((p) => p.id === 'backups');
  assert.ok(!hasPermissions, 'Staff employee must not see Permission Matrix');
  assert.ok(!hasBackups, 'Staff employee must not see Backups');
});
