import test from 'node:test';
import assert from 'node:assert/strict';

test('Concurrency Control: Optimistic Concurrency Control (OCC) Version Resolution', () => {
  interface Entity {
    id: string;
    title: string;
    version: number;
    updatedAt: string;
  }

  const databaseState: Entity = {
    id: 'task-101',
    title: 'Original Title',
    version: 3,
    updatedAt: '2026-11-24T10:00:00Z',
  };

  const applyUpdateWithOCC = (current: Entity, update: Partial<Entity> & { version?: number }) => {
    // If incoming version doesn't match current database version, raise 409 Conflict
    if (update.version !== undefined && update.version !== current.version) {
      const err: any = new Error('Conflict: Entity has been modified by another user.');
      err.status = 409;
      err.current = current;
      throw err;
    }

    return {
      ...current,
      ...update,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
  };

  // 1. Success case: Client provides current version (3)
  const validUpdate = { title: 'Updated Title', version: 3 };
  const updatedEntity = applyUpdateWithOCC(databaseState, validUpdate);
  assert.strictEqual(updatedEntity.title, 'Updated Title');
  assert.strictEqual(updatedEntity.version, 4);

  // 2. Conflict case: Client provides stale version (2)
  const staleUpdate = { title: 'Stale Title', version: 2 };
  assert.throws(
    () => applyUpdateWithOCC(databaseState, staleUpdate),
    (err: any) => err.status === 409 && err.current.version === 3
  );
});

test('Concurrency & Scalability: Cursor-Based Pagination', () => {
  const records = Array.from({ length: 45 }, (_, idx) => ({
    id: `rec-${String(idx + 1).padStart(3, '0')}`,
    sequence: idx + 1,
    name: `Record #${idx + 1}`,
  }));

  const paginateByCursor = (all: typeof records, cursor?: string, limit: number = 20) => {
    let startIndex = 0;
    if (cursor) {
      const foundIdx = all.findIndex((r) => r.id === cursor);
      if (foundIdx !== -1) startIndex = foundIdx + 1;
    }
    const slice = all.slice(startIndex, startIndex + limit);
    const nextCursor = slice.length === limit ? slice[slice.length - 1].id : null;
    return {
      items: slice,
      nextCursor,
      hasMore: nextCursor !== null,
      totalCount: all.length,
    };
  };

  // Page 1
  const page1 = paginateByCursor(records, undefined, 20);
  assert.strictEqual(page1.items.length, 20);
  assert.strictEqual(page1.items[0].id, 'rec-001');
  assert.strictEqual(page1.items[19].id, 'rec-020');
  assert.strictEqual(page1.nextCursor, 'rec-020');
  assert.strictEqual(page1.hasMore, true);

  // Page 2
  const page2 = paginateByCursor(records, page1.nextCursor!, 20);
  assert.strictEqual(page2.items.length, 20);
  assert.strictEqual(page2.items[0].id, 'rec-021');
  assert.strictEqual(page2.nextCursor, 'rec-040');
  assert.strictEqual(page2.hasMore, true);

  // Page 3 (final page with remaining 5 items)
  const page3 = paginateByCursor(records, page2.nextCursor!, 20);
  assert.strictEqual(page3.items.length, 5);
  assert.strictEqual(page3.items[0].id, 'rec-041');
  assert.strictEqual(page3.nextCursor, null);
  assert.strictEqual(page3.hasMore, false);
});
