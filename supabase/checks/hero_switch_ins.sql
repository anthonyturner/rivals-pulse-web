-- Proves the switch-in rules (migration 20261108190000, issue 655) on fixture matches in half-seasons
-- that do not exist, then rolls everything back. Run after applying the migration:
--   npx supabase db query --linked -f supabase/checks/hero_switch_ins.sql
-- It fails with an exception naming the rule that broke; it ends with a rollback, never a commit.
begin;

do $$
declare
  n integer;
  played timestamptz;
  recorder text;
  team_one_wins boolean;
  players jsonb;
  timelines jsonb;
  stored record;
  read_back record;
begin
  if exists (select 1 from public.participants where half_season in (997, 998)) then
    raise exception 'test half-seasons already exist';
  end if;

  -- Matches 1 to 10 each hold the same three switches. Team 1 (heroes 1011, 1014, 1015) won matches 1
  -- to 6 and lost 7 to 10; two players recorded them (matches 1 to 6 the first, 7 to 10 the second).
  --  * Team 1 switches to 1020 at second 100 and to 1015 at second 5, while two enemy players are on
  --    1033, so each is credited to 1033 once.
  --  * Team 2's player X goes from 1033 to 1034 at second 200, when team 1 fields 1020 and 1015, so
  --    1034 is credited to both.
  -- Matches 11 to 14 must count for nothing: no enemy timeline, a repeat of the same hero, no result,
  -- and an enemy who has not picked yet. Match 15 has the enemy's first pick in the same second as the
  -- switch, which counts (at or before).
  for n in 1..15 loop
    played := now() - make_interval(hours => n);
    recorder := case when n between 7 and 14 then 'tst-switch-b' else 'tst-switch-a' end;
    team_one_wins := n <= 6 or n = 15 or n in (11, 12, 14);

    select jsonb_agg(jsonb_build_object(
             'uid', 'tst-' || n || '-' || t.team || '-' || t.ord,
             'name', 'tst-' || n || '-' || t.team || '-' || t.ord,
             'team', t.team, 'hero_id', t.hero, 'kills', 1, 'deaths', 1, 'assists', 1,
             'is_win', case when n = 13 then null else (t.team = 1) = team_one_wins end))
      into players
    from (
      select 1 as team, h.hero, h.ord from unnest(array[1011, 1014, 1015]) with ordinality as h(hero, ord)
      union all
      select 2, h.hero, h.ord from unnest(array[1033, 1033, 1034]) with ordinality as h(hero, ord)
    ) t;

    perform public.record_match_participants('tst-switch-' || n, 997, played, recorder, players, 1::smallint, null);

    timelines := case
      when n = 11 then '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 100}]}]'
      when n = 12 then '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1011, "at_second": 50}]},
                        {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}]}]'
      when n = 14 then '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 10}]},
                        {"team": 2, "picks": [{"hero_id": 1033, "at_second": 50}]}]'
      when n = 15 then '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 50}]},
                        {"team": 2, "picks": [{"hero_id": 1033, "at_second": 50}]}]'
      else '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 100}]},
             {"team": 1, "picks": [{"hero_id": 1014, "at_second": 0}, {"hero_id": 1015, "at_second": 5}]},
             {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}, {"hero_id": 1034, "at_second": 200}]},
             {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}]}]'
    end::jsonb;

    perform public.record_match_hero_timelines('tst-switch-' || n, played, timelines);
  end loop;

  if not public.rebuild_hero_switch_in_aggregates(997) then
    raise exception 'a half-season with raw rows must be rebuilt';
  end if;

  if (select count(*) from public.hero_switch_ins where half_season = 997) <> 4 then
    raise exception 'exactly four switch-ins must be stored (a first pick, a repeat, a team with no enemy timeline, no result and an enemy not yet picked count for nothing): %',
      (select jsonb_agg(to_jsonb(s)) from public.hero_switch_ins s where s.half_season = 997);
  end if;
  raise notice 'ok: only switches with a known enemy and a result are counted';

  select * into stored from public.hero_switch_ins where half_season = 997 and hero_id = 1020 and enemy_hero_id = 1033;
  if not found or stored.play_mode_id <> 1 or stored.matches <> 11 or stored.switches <> 11 or stored.wins <> 7 then
    raise exception 'a switch must be credited once to an enemy hero two players had, an enemy picking in the same second must count, and the switching team''s result is the outcome: %', stored;
  end if;
  if stored.recorders <> 2 or stored.top_recorder_matches <> 7 then
    raise exception 'wrong recorder counts: %', stored;
  end if;
  raise notice 'ok: a switch is credited once per distinct enemy hero, with its own team''s result';

  select * into stored from public.hero_switch_ins where half_season = 997 and hero_id = 1034 and enemy_hero_id = 1020;
  if not found or stored.matches <> 10 or stored.switches <> 10 or stored.wins <> 4 then
    raise exception 'a switch by team 2 must take team 2''s result, and be credited to the enemy''s pick of that second: %', stored;
  end if;
  if not exists (select 1 from public.hero_switch_ins where half_season = 997 and hero_id = 1034 and enemy_hero_id = 1015)
     or not exists (select 1 from public.hero_switch_ins where half_season = 997 and hero_id = 1015 and enemy_hero_id = 1033) then
    raise exception 'a switch must be credited to every enemy hero on the field';
  end if;
  raise notice 'ok: a switch is credited to every enemy hero on the field, whichever team made it';

  select * into read_back
  from jsonb_to_recordset(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins')
       as r(half_season numeric, hero_id integer, enemy_hero_id integer, matches integer, switches integer, wins integer)
  where r.half_season = 997 and r.hero_id = 1020;
  if not found or read_back.matches <> 11 or read_back.wins <> 7 then
    raise exception 'the reader must return the switch-in that passes the gate: %', read_back;
  end if;
  if exists (
    select 1 from jsonb_to_recordset(public.read_hero_switch_ins(array[0]::smallint[]) -> 'switch_ins') as r(half_season numeric)
    where r.half_season = 997
  ) then
    raise exception 'a mode that was not asked for must not be returned';
  end if;
  raise notice 'ok: the reader returns the mode asked for and no other';

  -- A frozen half-season is never rebuilt, and the purge freezes before it deletes.
  perform public.record_match_participants('tst-switch-old', 998, now() - interval '2 years', 'tst-switch-a',
    '[{"uid": "tst-old-1", "name": "tst-old-1", "team": 1, "hero_id": 1011, "is_win": true},
      {"uid": "tst-old-2", "name": "tst-old-2", "team": 2, "hero_id": 1033, "is_win": false}]'::jsonb, 1::smallint, null);
  perform public.record_match_hero_timelines('tst-switch-old', now() - interval '2 years',
    '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 100}]},
      {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}]}]'::jsonb);
  perform public.purge_expired_participants();

  if exists (select 1 from public.participants where half_season = 998)
     or exists (select 1 from public.match_hero_timelines where fingerprint = 'tst-switch-old') then
    raise exception 'the purge must delete the expired match and its timelines';
  end if;
  if not exists (select 1 from public.hero_switch_ins where half_season = 998 and hero_id = 1020 and enemy_hero_id = 1033 and switches = 1)
     or not exists (select 1 from public.hero_switch_in_aggregate_half_seasons where half_season = 998 and frozen_at is not null) then
    raise exception 'the purge must freeze the switch-in counts before it deletes the raw rows';
  end if;
  if public.rebuild_hero_switch_in_aggregates(998) then
    raise exception 'a frozen half-season must not be rebuilt';
  end if;
  raise notice 'ok: the purge froze the counts before deleting the timelines they came from';

  if has_table_privilege('anon', 'public.hero_switch_ins', 'select')
     or has_table_privilege('authenticated', 'public.hero_switch_in_aggregate_half_seasons', 'select') then
    raise exception 'the count tables must not be readable by the publishable key';
  end if;
  if not has_function_privilege('anon', 'public.read_hero_switch_ins(smallint[])', 'execute')
     or has_function_privilege('authenticated', 'public.read_hero_switch_ins(smallint[])', 'execute')
     or has_function_privilege('anon', 'public.rebuild_hero_switch_in_aggregates(numeric, boolean)', 'execute') then
    raise exception 'function permissions changed';
  end if;
  raise notice 'ok: only the reader is open to the publishable key';
end
$$;

rollback;
