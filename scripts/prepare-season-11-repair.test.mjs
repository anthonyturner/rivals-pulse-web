import assert from 'node:assert/strict';
import test from 'node:test';
import { repairParameters } from './prepare-season-11-repair.mjs';

const match = { id: 1, played_at: '2026-11-13T11:10:00Z', recorded_by: 'a'.repeat(64), has_verified_link: true };

test('binds the audited recorder, exact IDs and a fixed end just after the last match', () => {
  assert.deepEqual(repairParameters({ matches: [{ ...match, id: 2 }, match] }), {
    recorder: 'a'.repeat(64), ids: [1, 2], before: '2026-11-13T11:10:00.001Z', count: 2,
  });
});

test('refuses empty, unverified, mixed-recorder, duplicate and pre-cutoff cohorts', () => {
  for (const matches of [[], [{ ...match, has_verified_link: false }],
    [match, { ...match, id: 2, recorded_by: 'b'.repeat(64) }], [match, match],
    [{ ...match, played_at: '2026-11-13T10:59:59Z' }], [{ ...match, id: '1;drop table participants' }]]) {
    assert.throws(() => repairParameters({ matches }));
  }
});
