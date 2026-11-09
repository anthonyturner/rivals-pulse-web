import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createdFunctions, escapeRegExp, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the hero forms migration (issue 667) for the
 * rules that are easy to break and expensive to find in production: a hero the game splits by role
 * (Deadpool) is one hero in the switch-in counts, nothing else about the fill changed, and the
 * restated function keeps its posture. `supabase/checks/hero_switch_ins.sql` proves the behaviour.
 */
const HERO_FORMS = '20261108210000_hero_switch_in_hero_forms.sql';
const EARLIER = '20261108200000_hero_timeline_recorder.sql';

const sql = withoutComments(read(HERO_FORMS));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};

describe('the hero forms migration', () => {
  it('restates the fill and nothing else, with the same signature and grants', () => {
    const functions = createdFunctions(sql);

    assert.deepEqual(functions, ['public.fill_hero_switch_in_aggregates(numeric)']);
    const escaped = escapeRegExp(functions[0]);
    assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function ${escaped} to service_role;`));
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
    assert.doesNotMatch(sql, /\b(create table|alter table|drop|create policy|cron\.schedule)\b/i);
    assert.doesNotMatch(sql, /purge_expired_participants/);
  });

  it('reads the base id of every hero it compares or stores, from the table the other families use', () => {
    const fill = bodyOf(sql, 'fill_hero_switch_in_aggregates');

    assert.deepEqual([...fill.matchAll(/left join ([\w.]+) (\w+) on (\w+)\.game_id = k\.hero_id/g)].map(match => match[1]), [
      'public.hero_game_roles',
      'public.hero_game_roles',
    ]);
    assert.match(fill, /coalesce\(h\.base_game_id, k\.hero_id\) as hero_id, k\.at_second,\s+lag\(coalesce\(h\.base_game_id, k\.hero_id\)\) over \(/);
    assert.match(fill, /select distinct on \(k\.timeline_no\) coalesce\(h\.base_game_id, k\.hero_id\) as hero_id/);
  });

  it('keeps an id the table does not know as it is, so a new hero is counted before it has a row', () => {
    assert.equal([...sql.matchAll(/coalesce\(h\.base_game_id, k\.hero_id\)/g)].length, 3);
    assert.equal([...sql.matchAll(/join public\.hero_game_roles/g)].length, [...sql.matchAll(/left join public\.hero_game_roles/g)].length);
  });

  it('is the earlier fill with only the base id read added', () => {
    const rewritten = squash(bodyOf(sql, 'fill_hero_switch_in_aggregates'))
      .replace('k.pick_no, coalesce(h.base_game_id, k.hero_id) as hero_id, k.at_second, lag(coalesce(h.base_game_id, k.hero_id)) over (', 'k.pick_no, k.hero_id, k.at_second, lag(k.hero_id) over (')
      .replaceAll(' left join public.hero_game_roles h on h.game_id = k.hero_id', '')
      .replace('select distinct on (k.timeline_no) coalesce(h.base_game_id, k.hero_id) as hero_id', 'select distinct on (k.timeline_no) k.hero_id');

    assert.equal(rewritten, squash(bodyOf(withoutComments(read(EARLIER)), 'fill_hero_switch_in_aggregates')));
  });

  it('counts one pick of a hero once per distinct enemy hero, so two enemy forms of one hero are one credit', () => {
    const fill = bodyOf(sql, 'fill_hero_switch_in_aggregates');

    assert.match(fill, /select distinct s\.fingerprint, s\.played_at, s\.timeline_no, s\.pick_no, s\.hero_id,\s+e\.hero_id as enemy_hero_id, s\.is_win/);
    assert.match(fill, /s\.previous_hero_id is not null and s\.hero_id <> s\.previous_hero_id/);
  });
});
