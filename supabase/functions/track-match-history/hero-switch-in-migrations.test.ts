import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the switch-in migration (issue 655) for the
 * rules that are easy to break and expensive to find in production: the posture of every new object,
 * the anonymity of the counts, how a switch is found and credited, the shape of the reader, and that
 * the purge still freezes every family and now freezes this one too.
 */
const SWITCH_INS = '20261108190000_hero_switch_in_aggregates.sql';
const EARLIER_PURGE = '20261108180000_match_hero_timelines.sql';
const READER = 'public.read_hero_switch_ins(smallint[])';

const sql = withoutComments(read(SWITCH_INS));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};

describe('the switch-in migration', () => {
  it('turns row level security on for both tables and leaves it with no policy', () => {
    assert.deepEqual(createdTables(sql).sort(), [
      'public.hero_switch_in_aggregate_half_seasons',
      'public.hero_switch_ins',
    ]);
    for (const table of createdTables(sql)) {
      assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
      assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
      assert.match(sql, new RegExp(`grant [a-z, ]+ on ${table} to service_role`), table);
    }
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.hero_switch_in\w* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('revokes execute from everyone on every function, and grants only the reader to the publishable key', () => {
    const functions = createdFunctions(sql);
    assert.ok(functions.includes(READER));
    assert.ok(functions.includes('public.purge_expired_participants()'));
    for (const signature of functions) {
      const escaped = escapeRegExp(signature);
      assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
      const grantee = signature === READER ? 'anon, service_role' : 'service_role';
      assert.match(sql, new RegExp(`grant execute on function ${escaped} to ${grantee};`), signature);
    }
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(authenticated|public)\b/i);
  });

  it('keeps every table free of who played: no uid, name, fingerprint, recorder or participant column', () => {
    for (const table of createdTables(sql)) {
      const columns = columnsOf(sql, table);
      assert.ok(columns.length > 0, `no columns read for ${table}`);
      for (const column of columns) {
        assert.doesNotMatch(column, /uid|name|fingerprint|recorded_by|participant|player/, `${table}.${column}`);
      }
    }
  });

  it('stores a switch-in as counts keyed by half-season, mode, the hero switched to and the enemy hero', () => {
    assert.deepEqual(columnsOf(sql, 'public.hero_switch_ins'), [
      'half_season', 'play_mode_id', 'hero_id', 'enemy_hero_id',
      'matches', 'switches', 'wins', 'recorders', 'top_recorder_matches',
    ]);
    assert.match(sql, /primary key \(half_season, play_mode_id, hero_id, enemy_hero_id\)/);
  });

  it('is its own family: it adds a fill, rebuild, recompute and freeze and touches no other family', () => {
    const functions = createdFunctions(sql);
    for (const name of ['fill', 'rebuild', 'recompute', 'freeze']) {
      assert.ok(functions.some(signature => signature.startsWith(`public.${name}_hero_switch_in_aggregates(`)), name);
    }
    assert.doesNotMatch(sql, /function public\.(fill|rebuild|recompute|freeze)_(hero|hero_pair|extended|triple_support)_aggregates/);
    assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
    assert.doesNotMatch(sql, /\balter table\b(?! public\.hero_switch_in\w* enable row level security)/i);
    assert.match(sql, /cron\.schedule\('recompute-hero-switch-in-aggregates', '53 \* \* \* \*'/);
  });

  it('runs its hourly job at a minute no other job uses', () => {
    const minutes = readdirSync(MIGRATIONS)
      .filter(name => name.endsWith('.sql'))
      .flatMap(name => [...withoutComments(read(name)).matchAll(/cron\.schedule\(\s*'([\w-]+)',\s*'(\d+) \* \* \* \*'/g)]
        .map(match => ({ job: match[1], minute: match[2] })))
      .filter(({ job }) => job !== 'recompute-hero-switch-in-aggregates');
    assert.ok(minutes.length > 0);
    assert.ok(!minutes.some(({ minute }) => minute === '53'), JSON.stringify(minutes));
  });

  describe('fill_hero_switch_in_aggregates', () => {
    const fill = bodyOf(sql, 'fill_hero_switch_in_aggregates');

    it('reads only the half-season it was asked for, from the scoreboard and the timelines', () => {
      assert.match(fill, /from public\.participants p\s+where p\.half_season = p_half_season\s+group by p\.fingerprint, p\.played_at/);
      assert.match(fill, /from public\.match_hero_timelines t\s+where t\.half_season = p_half_season/);
    });

    it('takes a switch to be a pick after the first that names a different hero', () => {
      assert.match(fill, /lag\(t\.hero_id\) over \(\s*partition by t\.fingerprint, t\.played_at, t\.timeline_no order by t\.pick_no\s*\) as previous_hero_id/);
      assert.match(fill, /s\.previous_hero_id is not null and s\.hero_id <> s\.previous_hero_id/);
    });

    it('takes the outcome from the switching team and drops a switch whose team has no result', () => {
      assert.match(fill, /join teams t on t\.fingerprint = s\.fingerprint and t\.played_at = s\.played_at and t\.team = s\.team/);
      assert.match(fill, /and t\.is_win is not null/);
      assert.match(fill, /case when bool_and\(p\.is_win\) then true when not bool_or\(p\.is_win\) then false end as is_win/);
    });

    it('credits a switch once to each distinct enemy hero on the field, by each enemy timeline\'s latest pick at or before it', () => {
      assert.match(fill, /select distinct s\.fingerprint, s\.played_at, s\.timeline_no, s\.pick_no, s\.hero_id,\s+e\.hero_id as enemy_hero_id, s\.is_win/);
      assert.match(fill, /select distinct on \(k\.timeline_no\) k\.hero_id/);
      assert.match(fill, /k\.team <> s\.team and k\.at_second <= s\.at_second\s+order by k\.timeline_no, k\.pick_no desc/);
    });

    it('needs the enemy team\'s timeline: a switch with no enemy pick has no credit row, and no outer join invents one', () => {
      assert.match(fill, /cross join lateral \(/);
      assert.doesNotMatch(fill, /left join/);
    });

    it('counts recorders as the other families do, from the scoreboard\'s recorder, and keeps the busiest one\'s matches', () => {
      assert.match(fill, /min\(p\.recorded_by\) as recorder/);
      assert.match(fill, /count\(\*\)::integer, max\(r\.matches\)::integer/);
      assert.match(fill, /count\(distinct m\.match_no\) as matches/);
    });
  });

  describe('read_hero_switch_ins', () => {
    const reader = bodyOf(sql, 'read_hero_switch_ins');

    it('takes the modes asked for, runs as its owner and returns one jsonb value', () => {
      assert.match(reader, /p_play_mode_ids smallint\[\]/);
      assert.match(reader, /returns jsonb/);
      assert.match(reader, /security definer/);
      assert.match(reader, /x\.play_mode_id = any \(p_play_mode_ids\)/);
    });

    it('returns the figures and no recorder count', () => {
      const keys = [...reader.matchAll(/'(\w+)', r\./g)].map(match => match[1]);
      assert.deepEqual(keys, ['half_season', 'hero_id', 'enemy_hero_id', 'matches', 'switches', 'wins']);
      assert.doesNotMatch(reader, /'recorders'|'top_recorder_matches'/);
    });

    it('gates each row of each mode on its own recorders before summing, never on a combined figure', () => {
      assert.match(reader, /public\.hero_figure_qualifies\(x\.matches, x\.recorders, x\.top_recorder_matches\)/);
      assert.ok(reader.indexOf('hero_figure_qualifies') < reader.indexOf('group by x.half_season'));
      assert.doesNotMatch(reader, /(max|sum)\(x\.(recorders|top_recorder_matches)\)/);
    });
  });

  it('uses the latest hero_figure_qualifies, so the gate is the two-player rule', () => {
    const definers = readdirSync(MIGRATIONS)
      .filter(name => name.endsWith('.sql') && name < SWITCH_INS && withoutComments(read(name)).includes('function public.hero_figure_qualifies('));
    assert.equal(definers.at(-1), '20261108120000_two_player_community_minimum.sql');
  });

  it('is printed by the website with the minimums of the latest hero_figure_qualifies', () => {
    const latest = readdirSync(MIGRATIONS)
      .filter(name => name.endsWith('.sql'))
      .sort()
      .map(name => withoutComments(read(name)))
      .filter(text => text.includes('function public.hero_figure_qualifies('))
      .at(-1);
    const database = latest?.match(/function public\.hero_figure_qualifies[\s\S]*?p_matches >= (\d+)\s+and p_recorders >= (\d+)/);
    const website = readFileSync(new URL('../../../src/server/heroes/switch-ins/hero-switch-ins.ts', import.meta.url), 'utf8');

    assert.ok(database);
    assert.equal(website.match(/SWITCH_IN_MIN_MATCHES = (\d+);/)?.[1], database[1]);
    assert.equal(website.match(/SWITCH_IN_MIN_PLAYERS = (\d+);/)?.[1], database[2]);
  });

  it('checks the gate when it runs: a hidden fixture must not come back, and the fixtures are rolled back', () => {
    assert.match(sql, /assert not one_recorder_returned/);
    assert.match(sql, /assert three_recorders_matches = 10/);
    assert.match(sql, /assert both_modes_matches = 10/);
    assert.match(sql, /raise exception 'roll back the gate fixtures' using errcode = 'P0042'/);
    assert.match(sql, /exception when sqlstate 'P0042' then\s+null;/);
  });

  it('lets only the fixture inserts be skipped: an error from the reader itself fails the push', () => {
    const handlers = [...sql.matchAll(/exception when others then\s+raise warning 'hero switch-in gate check skipped/g)];
    assert.equal(handlers.length, 1);
    assert.ok(handlers[0].index < sql.indexOf('read_hero_switch_ins(array[0]::smallint[])'));
  });
});

describe('the purge after the switch-in migration', () => {
  const body = bodyOf(sql, 'purge_expired_participants');
  const earlier = bodyOf(withoutComments(read(EARLIER_PURGE)), 'purge_expired_participants');
  const freeze = 'perform public.freeze_hero_switch_in_aggregates();';

  it('is the earlier purge with only the switch-in freeze added', () => {
    assert.ok(body.includes(freeze));
    assert.equal(squash(body.replace(freeze, '')), squash(earlier));
  });

  it('freezes every family, this one included, before the first delete', () => {
    const everyFreeze = [
      ...new Set(
        readdirSync(MIGRATIONS)
          .filter(name => name.endsWith('.sql'))
          .flatMap(name => [...withoutComments(read(name)).matchAll(/create or replace function (public\.freeze_\w+)\(/g)].map(match => `${match[1]}(`)),
      ),
      'public.rebuild_hero_aggregates(',
    ];
    assert.ok(everyFreeze.includes('public.freeze_hero_switch_in_aggregates('));

    const firstDelete = body.indexOf('delete from');
    for (const call of everyFreeze) {
      const at = body.indexOf(call);
      assert.ok(at >= 0, `the purge no longer calls ${call}`);
      assert.ok(at < firstDelete, `${call} must run before the first delete`);
    }
  });

  it('still deletes the scoreboard, the kill feed and the timelines', () => {
    assert.match(body, /delete from public\.participants p/);
    assert.match(body, /delete from public\.match_hero_kills k/);
    assert.match(body, /delete from public\.match_hero_timelines t\s+where public\.participants_past_retention\(t\.half_season, t\.played_at\);/);
  });

  it('is the latest purge, so a later restatement has to be checked against this one', () => {
    const later = readdirSync(MIGRATIONS)
      .filter(name => name > SWITCH_INS && withoutComments(read(name)).includes('function public.purge_expired_participants('));
    assert.deepEqual(later, []);
  });
});
