import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the hero XP freeze migration (issue 868) for the rules
 * that are easy to break and expensive to find in production: what is kept (totals and an account link, never who
 * played), who can reach it, and that the purge freezes before it deletes. The numbers the freeze gives are held to
 * the TypeScript by `scripts/hero-xp-carry.test.ts` and `supabase/checks/hero_xp_carry_overs.sql`.
 */
const CARRY = '20261115130000_hero_xp_carry_overs.sql';
const EARLIER_PURGE = '20261108190000_hero_switch_in_aggregates.sql';
const EARLIER_READ = '20261114100000_hero_progress_matches.sql';
const READER = 'public.read_own_hero_progress_matches()';

const sql = withoutComments(read(CARRY));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};

describe('the hero XP carry-over migration', () => {
  it('keeps two tables, closed to everyone but the service role, with no policy', () => {
    assert.deepEqual(createdTables(sql).sort(), ['public.hero_xp_carry_chains', 'public.hero_xp_carry_overs']);
    for (const table of createdTables(sql)) {
      assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
      assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
      assert.match(sql, new RegExp(`grant select, insert, update, delete on ${table} to service_role`), table);
    }
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.hero_xp_carry_\w+ to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('stores only an account and per-hero totals: no uid, name, fingerprint, recorder or match column', () => {
    assert.deepEqual(columnsOf(sql, 'public.hero_xp_carry_overs'), ['user_id', 'half_season', 'hero_id', 'base_xp', 'time_xp', 'bonus_xp']);
    assert.deepEqual(columnsOf(sql, 'public.hero_xp_carry_chains'), ['user_id', 'last_bonus_win_at', 'last_counted_at']);
  });

  it('belongs to the link, so unlinking and relinking delete it', () => {
    for (const table of createdTables(sql)) {
      const start = sql.indexOf(`create table if not exists ${table}`);
      const definition = sql.slice(start, sql.indexOf(');', start));
      assert.match(definition, /user_id uuid [^,]*references public\.player_links \(user_id\) on delete cascade/, table);
    }
  });

  it('revokes execute from everyone on every function and grants it only to who needs it', () => {
    const functions = createdFunctions(sql);
    assert.deepEqual([...functions].sort(), [
      'public.forget_player(text, text)',
      'public.freeze_hero_xp_carry_overs()',
      'public.hero_xp_epoch_ms(timestamptz)',
      'public.purge_expired_participants()',
      READER,
    ]);
    for (const signature of functions) {
      const escaped = escapeRegExp(signature);
      assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
      assert.match(sql, new RegExp(`grant execute on function ${escaped} to ${signature === READER ? 'authenticated' : 'service_role'};`), signature);
    }
    assert.match(sql, /revoke execute on function public\.read_own_hero_progress_matches\(\) from public, anon, authenticated, service_role;/);
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(anon|public)\b/i);
  });
});

describe('the purge after the hero XP migration', () => {
  const body = bodyOf(sql, 'purge_expired_participants');
  const earlier = bodyOf(withoutComments(read(EARLIER_PURGE)), 'purge_expired_participants');
  const freeze = 'perform public.freeze_hero_xp_carry_overs();';

  it('is the earlier purge with only the hero XP freeze added', () => {
    assert.ok(body.includes(freeze));
    assert.equal(squash(body.replace(freeze, '')), squash(earlier));
  });

  it('freezes every family, this one included, before the first delete, in the one function and so the one transaction', () => {
    const everyFreeze = [
      ...new Set(
        readdirSync(MIGRATIONS)
          .filter(name => name.endsWith('.sql'))
          .flatMap(name => [...withoutComments(read(name)).matchAll(/create or replace function (public\.freeze_\w+)\(/g)].map(match => `${match[1]}(`)),
      ),
      'public.rebuild_hero_aggregates(',
    ];
    assert.ok(everyFreeze.includes('public.freeze_hero_xp_carry_overs('));

    const firstDelete = body.indexOf('delete from');
    for (const call of everyFreeze) {
      const at = body.indexOf(call);
      assert.ok(at >= 0, `the purge no longer calls ${call}`);
      assert.ok(at < firstDelete, `${call} must run before the first delete`);
    }
    assert.doesNotMatch(body, /\b(commit|rollback)\b/i);
  });

  it('is the latest purge, so a later restatement has to be checked against this one', () => {
    const later = readdirSync(MIGRATIONS)
      .filter(name => name > CARRY && withoutComments(read(name)).includes('function public.purge_expired_participants('));
    assert.deepEqual(later, []);
  });
});

describe('the freeze', () => {
  const freeze = bodyOf(sql, 'freeze_hero_xp_carry_overs');

  it('asks the retention rule which rows are going, so it cannot disagree with the delete', () => {
    assert.match(freeze, /public\.participants_past_retention\(p\.half_season, p\.played_at\)/);
  });

  it('takes a line as the account\'s own only when both the recorder and the uid of its link match', () => {
    assert.match(freeze, /p\.recorded_by = own\.recorder_id\s+and p\.uid = own\.player_uid/);
  });

  it('counts only Quick Match and Competitive, in play order with the line ids read as text', () => {
    assert.match(freeze, /p\.play_mode_id in \(0, 1\)/);
    assert.match(freeze, /order by public\.hero_xp_epoch_ms\(p\.played_at\), p\.id::text collate "C"/);
  });

  it('counts only lines after the stored last counted time, so a second call counts nothing twice', () => {
    assert.match(
      freeze,
      /and \(chain_counted_at is null\s+or public\.hero_xp_epoch_ms\(p\.played_at\) > public\.hero_xp_epoch_ms\(chain_counted_at\)\)/,
    );
    assert.match(freeze, /chain_counted_at := greatest\(chain_counted_at, line\.played_at\);/);
  });

  it('stores no match, uid or name', () => {
    const inserts = [...freeze.matchAll(/insert into (public\.\w+)/g)].map(match => match[1]).sort();
    assert.deepEqual([...new Set(inserts)], ['public.hero_xp_carry_chains', 'public.hero_xp_carry_overs']);
  });
});

describe('forget_player after the hero XP migration', () => {
  it('still does what it did and also deletes the frozen totals of any link that names the player', () => {
    const body = bodyOf(sql, 'forget_player');

    assert.match(body, /delete from public\.participants/);
    assert.match(body, /delete from public\.hero_xp_carry_overs o\s+using public\.player_links k/);
    assert.match(body, /delete from public\.hero_xp_carry_chains c\s+using public\.player_links k/);
    assert.match(body, /return removed;/);
  });
});

describe('the owner read after the hero XP migration', () => {
  const body = bodyOf(sql, 'read_own_hero_progress_matches');

  it('keeps its posture: no parameters, the caller\'s own link through auth.uid(), definer with an empty search path', () => {
    assert.match(body, /create or replace function public\.read_own_hero_progress_matches\(\)/);
    assert.match(body, /\(select auth\.uid\(\)\)/);
    assert.match(body, /where l\.recorded_by = own_link\.recorder_id\s+and l\.uid = own_link\.player_uid/);
    assert.match(sql, /read_own_hero_progress_matches\(\)\s+returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/);
  });

  it('reads the carry-overs of the caller\'s own account and no other', () => {
    assert.match(body, /from public\.hero_xp_carry_overs o\s+where o\.user_id = account/);
    assert.match(body, /from public\.hero_xp_carry_chains c where c\.user_id = account/);
  });

  it('leaves what it already answered as it was', () => {
    const earlier = bodyOf(withoutComments(read(EARLIER_READ)), 'read_own_hero_progress_matches');
    const matches = (text: string) => squash(text.slice(text.indexOf('select coalesce(jsonb_agg('), text.indexOf('into found_matches')));

    assert.equal(matches(body), matches(earlier));
  });
});
