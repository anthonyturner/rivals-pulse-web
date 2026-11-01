import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it, mock } from 'node:test';
import { recordTrackedMatchRecorder, type RecorderTable } from './tracked-match-recorder.ts';

function fakeClient(outcome: { error: { message: string } | null } | Error) {
  const calls: unknown[][] = [];
  const client: RecorderTable = {
    from: table => ({
      upsert: (row, options) => {
        calls.push([table, row, options]);
        return outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome);
      },
    }),
  };
  return { client, calls };
}

describe('recordTrackedMatchRecorder', () => {
  it('stores the recorder against the tracked match, replacing an earlier one', async () => {
    const { client, calls } = fakeClient({ error: null });
    await recordTrackedMatchRecorder(client, 42, 'abc123');
    assert.deepEqual(calls, [[
      'tracked_match_recorders',
      { tracked_match_id: 42, recorded_by: 'abc123' },
      { onConflict: 'tracked_match_id' },
    ]]);
  });

  for (const [name, outcome] of [
    ['reports an error', { error: { message: 'relation does not exist' } }],
    ['throws', new Error('network down')],
  ] as const) {
    it(`logs and carries on when the write ${name}`, async () => {
      const log = mock.method(console, 'error', () => {});
      try {
        const { client } = fakeClient(outcome);
        await assert.doesNotReject(recordTrackedMatchRecorder(client, 42, 'abc123'));
        assert.equal(log.mock.callCount(), 1);
        assert.match(String(log.mock.calls[0].arguments[0]), /Tracked match recorder not stored/);
      } finally {
        log.mock.restore();
      }
    });
  }
});

describe('the tracked_match_recorders migration', () => {
  const migrations = new URL('../../migrations/', import.meta.url);
  const sql = readFileSync(new URL('20261101030000_tracked_match_recorders.sql', migrations), 'utf8')
    .replace(/--.*$/gm, '');

  it('keys the side row to the tracked match and deletes it with the match', () => {
    assert.match(sql, /tracked_match_id bigint primary key references public\.tracked_matches \(id\) on delete cascade/);
    assert.match(sql, /recorded_by text not null/);
  });

  it('turns row level security on and gives clients nothing', () => {
    assert.match(sql, /alter table public\.tracked_match_recorders enable row level security/);
    assert.match(sql, /revoke all on public\.tracked_match_recorders from anon, authenticated/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('adds no recorded_by to the publicly readable tracked_matches', () => {
    assert.doesNotMatch(sql, /alter table public\.tracked_matches/i);
  });
});
