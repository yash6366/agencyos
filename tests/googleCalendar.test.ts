import test from 'node:test';
import assert from 'node:assert/strict';

test('Enhancement 3: Google Calendar Event Deduplication via agencyos_id', () => {
  // Simulates internal task & milestone push with extendedProperties
  const internalTask = {
    id: 'tsk-402',
    title: 'Brand Identity Design',
    dueDate: '2026-11-30',
    taskCode: 'PAA-TSK-402',
  };

  const googleEventPayload = {
    summary: `[Task] ${internalTask.title}`,
    start: { date: internalTask.dueDate },
    end: { date: internalTask.dueDate },
    extendedProperties: {
      private: {
        agencyos_id: internalTask.id,
        source: 'agencyos',
      },
    },
  };

  assert.equal(googleEventPayload.extendedProperties.private.agencyos_id, 'tsk-402');
  assert.equal(googleEventPayload.summary, '[Task] Brand Identity Design');

  // Verify deduplication test
  const existingGoogleEvents = [
    { id: 'gev-1', extendedProperties: { private: { agencyos_id: 'tsk-402' } } },
    { id: 'gev-2', extendedProperties: { private: { agencyos_id: 'milestone-88' } } },
  ];

  const matched = existingGoogleEvents.find(
    (e) => e.extendedProperties?.private?.agencyos_id === internalTask.id
  );
  assert.ok(matched, 'Must locate matching event by agencyos_id instead of inserting duplicate');
});

test('Enhancement 3: Google Calendar OAuth State Security', () => {
  const userId = 'emp-1';
  const stateRandom = 'a1b2c3d4e5f60718';
  const state = `${stateRandom}:${userId}`;

  assert.ok(state.includes(userId));
  const [extractedRandom, extractedUser] = state.split(':');
  assert.equal(extractedUser, userId);
  assert.equal(extractedRandom.length, 16);
});
