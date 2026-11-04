import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';
import { ABILITY_SLOTS } from './extended-payload.ts';

/**
 * The extended upload's migrations cannot be run by this repo's tests (no database here), so these
 * read the SQL for the rules that are easy to break and expensive to find in production: the
 * posture of every new object, the anonymity of the aggregates, and that the purge still freezes
 * them before it deletes.
 */
const UPLOAD = '20261030120000_extended_upload.sql';
const AGGREGATES = '20261030120100_extended_aggregates.sql';
const CONTRIBUTORS = '20261104120000_hero_figure_contributors.sql';

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
          const escaped = escapeRegExp(signature);
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

  describe(CONTRIBUTORS, () => {
    const sql = withoutComments(read(CONTRIBUTORS));
    const functionBody = (name: string): string => {
      const start = sql.indexOf(`create or replace function public.${name}(`);
      assert.ok(start >= 0, `${name} is not defined`);
      return sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));
    };

    it('turns row level security on for its tables with no policy and grants only to the service role', () => {
      assert.deepEqual(createdTables(sql).sort(), ['public.hero_ability_aggregates', 'public.participant_hero_ability_uses']);
      for (const table of createdTables(sql)) {
        assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
        assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
      }
      assert.doesNotMatch(sql, /create policy/i);
      assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
    });

    it('revokes execute from everyone and grants it to the service role for every function', () => {
      for (const signature of createdFunctions(sql)) {
        const escaped = escapeRegExp(signature);
        assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
        assert.match(sql, new RegExp(`grant execute on function ${escaped} to service_role`), signature);
      }
    });

    it('only adds: not null columns defaulting to 0, nothing dropped, renamed or retyped', () => {
      assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
      assert.doesNotMatch(sql, /\balter table [^;]*\b(rename|alter column|drop)\b/i);
      const added = [...sql.matchAll(/add column if not exists \w+ integer not null default 0/g)];
      assert.equal(added.length, [...sql.matchAll(/add column/g)].length);
      assert.equal(added.length, 10);
    });

    it('never restates the purge or the functions the deployed Edge Function calls', () => {
      assert.doesNotMatch(sql, /function public\.(purge_expired_participants|record_match_participants|record_match_extras)\b/);
    });

    it('holds the qualifying rule in one function, whose player minimum the website prints', () => {
      const rule = functionBody('hero_figure_qualifies');
      assert.match(rule, /p_matches >= 10 and p_recorders >= 3 and p_top_recorder_matches \* 2 <= p_matches/);
      const latestRule = readdirSync(MIGRATIONS)
        .filter(name => name.endsWith('.sql'))
        .sort()
        .map(name => withoutComments(read(name)))
        .filter(migration => migration.includes('function public.hero_figure_qualifies('))
        .at(-1) ?? '';
      const playerMinimum = latestRule.match(/p_recorders >= (\d+)/)?.[1];
      for (const file of ['community-figures.ts', 'community-kills.ts']) {
        const website = readFileSync(new URL(`../../../src/server/community/extended/${file}`, import.meta.url), 'utf8');
        assert.match(website, new RegExp(`recorders: ${playerMinimum},`), file);
      }
    });

    it('applies the rule to every figure and every pair the read functions return', () => {
      const figures = functionBody('read_community_hero_figures');
      for (const figure of ['damage', 'healing', 'blocked']) {
        assert.match(figures, new RegExp(`hero_figure_qualifies\\(a\\.${figure}_n, a\\.${figure}_recorders, a\\.${figure}_top_recorder_n\\)`), figure);
      }
      assert.match(figures, /where s\.damage or s\.healing or s\.blocked/);
      assert.match(functionBody('read_community_kill_feed'), /where public\.hero_figure_qualifies\(a\.matches, a\.recorders, a\.top_recorder_matches\)/);
    });

    it('makes the read functions security definer with an empty search path', () => {
      for (const name of ['read_community_hero_figures', 'read_community_kill_feed']) {
        const body = functionBody(name);
        const header = body.slice(0, body.indexOf('as $$'));
        assert.match(header, /security definer/, name);
        assert.match(header, /set search_path = ''/, name);
      }
    });

    it('returns no uid, name, fingerprint, recorder or per-player key', () => {
      for (const name of ['read_community_hero_figures', 'read_community_kill_feed']) {
        const keys = [...functionBody(name).matchAll(/'(\w+)',/g)].map(match => match[1]);
        assert.ok(keys.length > 0, name);
        for (const key of keys) {
          assert.doesNotMatch(key, /uid|name|fingerprint|recorder|participant|player/, `${name}: ${key}`);
        }
      }
    });

    it('drops an all-zero segment and counts a figure only on segments with a time played', () => {
      const fill = functionBody('fill_extended_aggregates');
      assert.match(fill, /where not \(\s*coalesce\(f\.seconds, 0\) > 0\s*and coalesce\(f\.damage_dealt, 0\) = 0\s*and coalesce\(f\.healing, 0\) = 0\s*and coalesce\(f\.damage_blocked, 0\) = 0/);
      for (const figure of ['damage_dealt', 'healing', 'damage_blocked']) {
        assert.match(fill, new RegExp(`sum\\(l\\.${figure}\\) filter \\(where l\\.seconds > 0\\)`), figure);
      }
    });

    it("counts a recorder by the line's uid, never by who uploaded the match", () => {
      const fill = functionBody('fill_extended_aggregates');
      assert.match(fill, /p\.uid as recorder/);
      assert.doesNotMatch(fill, /recorded_by/);
    });

    it('never counts an unattributed kill feed as a recorder, and charges it to the busiest one', () => {
      const fill = functionBody('fill_extended_aggregates');
      const pairs = fill.slice(fill.indexOf('pairs as ('));
      assert.match(pairs, /count\(x\.source\)::integer/);
      assert.match(pairs, /max\(x\.matches\) filter \(where x\.source is not null\)/);
      assert.match(pairs, /sum\(x\.matches\) filter \(where x\.source is null\)/);
    });

    it("ties ability counts to the recorder's scoreboard line, so retention and forgetting reach them", () => {
      assert.match(sql, /participant_id bigint not null references public\.participants \(id\) on delete cascade/);
      assert.match(functionBody('record_match_ability_uses'), /p\.uid = p_recorder_uid/);
    });

    it('rebuilds the ability aggregates with the others, and keeps the slot list in step with the upload', () => {
      assert.match(functionBody('rebuild_extended_aggregates'), /delete from public\.hero_ability_aggregates/);
      assert.match(functionBody('recompute_extended_aggregates'), /participant_hero_ability_uses/);
      for (const slot of ABILITY_SLOTS) {
        assert.equal([...sql.matchAll(new RegExp(`'${slot}'`, 'g'))].length, 2, slot);
      }
    });

    it('keeps the aggregate tables free of who played', () => {
      for (const column of columnsOf(sql, 'public.hero_ability_aggregates')) {
        assert.doesNotMatch(column, /uid|name|fingerprint|recorded_by|participant/, column);
      }
    });
  });
});
