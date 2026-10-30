import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The extended upload's migrations cannot be run by this repo's tests (no database here), so these
 * read the SQL for the rules that are easy to break and expensive to find in production: the
 * posture of every new object, the anonymity of the aggregates, and that the purge still freezes
 * them before it deletes.
 */
const MIGRATIONS = new URL('../../migrations/', import.meta.url);
const UPLOAD = '20261030120000_extended_upload.sql';
const AGGREGATES = '20261030120100_extended_aggregates.sql';

const read = (name: string): string => readFileSync(new URL(name, MIGRATIONS), 'utf8');
const withoutComments = (sql: string): string => sql.replace(/--.*$/gm, '');

function createdTables(sql: string): string[] {
  return [...withoutComments(sql).matchAll(/create table if not exists (public\.\w+)/g)].map(match => match[1]);
}

function createdFunctions(sql: string): string[] {
  return [...withoutComments(sql).matchAll(/create or replace function (public\.\w+)\(([^)]*)\)/g)].map(match => {
    const types = match[2].split(',').map(argument => argument.trim().split(/\s+/)[1]).filter(Boolean);
    return `${match[1]}(${types.join(', ')})`;
  });
}

function columnsOf(sql: string, table: string): string[] {
  const body = withoutComments(sql).match(new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';
  return body.split('\n')
    .map(line => line.trim().split(/\s+/)[0])
    .filter(word => /^[a-z_]+$/.test(word) && !['primary', 'constraint', 'unique', 'check'].includes(word));
}

describe('the extended upload migrations', () => {
  for (const file of [UPLOAD, AGGREGATES]) {
    describe(file, () => {
      const sql = withoutComments(read(file));

      it('turns row level security on for every table and leaves it with no policy', () => {
        assert.ok(createdTables(sql).length > 0);
        for (const table of createdTables(sql)) {
          assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
          assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
          assert.match(sql, new RegExp(`grant [a-z, ]+ on ${table} to service_role`), table);
        }
        assert.doesNotMatch(sql, /create policy/i);
      });

      it('grants nothing to anon, authenticated or public', () => {
        assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
      });

      it('revokes execute from everyone and grants it to the service role for every function', () => {
        for (const signature of createdFunctions(sql)) {
          const escaped = signature.replace(/[().,]/g, '\\$&');
          assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
          assert.match(sql, new RegExp(`grant execute on function ${escaped} to service_role`), signature);
        }
      });

      it('never changes record_match_participants, whose second overload would fail every upload', () => {
        assert.doesNotMatch(sql, /function public\.record_match_participants/);
      });

      it('only adds: nothing is dropped, renamed or retyped', () => {
        assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
        assert.doesNotMatch(sql, /\balter table [^;]*\b(rename|alter column|drop)\b/i);
      });
    });
  }

  it('keeps every aggregate table free of who played: no uid, name, fingerprint or recorder', () => {
    const aggregates = read(AGGREGATES);
    const tables = createdTables(aggregates);
    assert.deepEqual(tables.sort(), [
      'public.extended_aggregate_half_seasons',
      'public.hero_figure_aggregates',
      'public.hero_kill_aggregates',
      'public.hero_kill_totals',
    ]);
    for (const table of tables) {
      const columns = columnsOf(aggregates, table);
      assert.ok(columns.length > 0, `no columns read for ${table}`);
      for (const column of columns) {
        assert.doesNotMatch(column, /uid|name|fingerprint|recorded_by|participant/, `${table}.${column}`);
      }
    }
  });

  it('stores the kill feed by hero only, with no player column', () => {
    const columns = columnsOf(read(UPLOAD), 'public.match_hero_kills');
    assert.deepEqual(columns, ['id', 'fingerprint', 'half_season', 'played_at', 'killer_hero', 'victim_hero', 'kills', 'recorded_at']);
  });

  it('ties a hero figure to the recorder\'s scoreboard line, so retention and forgetting reach it', () => {
    assert.match(withoutComments(read(UPLOAD)), /participant_id bigint not null references public\.participants \(id\) on delete cascade/);
  });

  it('leaves the latest purge freezing both aggregate sets before it deletes anything', () => {
    const purges = readdirSync(MIGRATIONS)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .map(name => ({ name, sql: withoutComments(read(name)) }))
      .filter(({ sql }) => /create or replace function public\.purge_expired_participants\(\)/.test(sql));
    const latest = purges.at(-1);
    assert.ok(latest, 'no migration defines the purge');

    const body = latest.sql.slice(latest.sql.indexOf('create or replace function public.purge_expired_participants()'));
    const firstDelete = body.indexOf('delete from');
    for (const freeze of ['public.rebuild_hero_aggregates(', 'public.freeze_extended_aggregates()']) {
      const at = body.indexOf(freeze);
      assert.ok(at >= 0, `${latest.name}: the purge no longer calls ${freeze}`);
      assert.ok(at < firstDelete, `${latest.name}: ${freeze} must run before the first delete`);
    }
  });
});
