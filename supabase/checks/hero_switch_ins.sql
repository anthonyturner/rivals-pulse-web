-- Proves the switch-in rules (migrations 20261108190000 and 20261108200000, issues 655 and 666) on fixture
-- matches in half-seasons that do not exist, then rolls everything back. Run after applying the migrations:
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
  -- Matches 11, 12 and 14 must count for nothing: no enemy timeline, a repeat of the same hero, and an
  -- enemy who has not picked yet. Match 13 has the same switches as 1 to 10 but no result: its switches
  -- and matches are counted, its decided figures are not. Match 15 has the enemy's first pick in the
  -- same second as the switch, which counts (at or before).
  -- Matches 16 to 24 are nine decided matches of one more switch (1017 against 1033), recorded by
  -- three different players: under 10 matches, so the reader must never return them.
  for n in 1..24 loop
    played := now() - make_interval(hours => n);
    recorder := case
      when n between 16 and 24 then 'tst-nine-' || (n % 3)
      when n between 7 and 14 then 'tst-switch-b'
      else 'tst-switch-a'
    end;
    team_one_wins := n <= 6 or n = 15 or n in (11, 12, 14) or n >= 16;

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
      when n >= 16 then '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1017, "at_second": 100}]},
                        {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}]}]'
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

  if (select count(*) from public.hero_switch_ins where half_season = 997) <> 5 then
    raise exception 'exactly five switch-ins must be stored (a first pick, a repeat, a team with no enemy timeline and an enemy not yet picked count for nothing): %',
      (select jsonb_agg(to_jsonb(s)) from public.hero_switch_ins s where s.half_season = 997);
  end if;
  raise notice 'ok: only switches with a known enemy are counted';

  select * into stored from public.hero_switch_ins where half_season = 997 and hero_id = 1020 and enemy_hero_id = 1033;
  if not found or stored.play_mode_id <> 1 or stored.decided_matches <> 11 or stored.decided_switches <> 11 or stored.wins <> 7 then
    raise exception 'a switch must be credited once to an enemy hero two players had, an enemy picking in the same second must count, and the switching team''s result is the outcome: %', stored;
  end if;
  if stored.matches <> 12 or stored.switches <> 12 then
    raise exception 'a switch with no result must stay in matches and switches: %', stored;
  end if;
  if stored.recorders <> 2 or stored.top_recorder_matches <> 7 then
    raise exception 'wrong recorder counts: %', stored;
  end if;
  raise notice 'ok: a switch is credited once per distinct enemy hero, with its own team''s result';

  select * into stored from public.hero_switch_ins where half_season = 997 and hero_id = 1034 and enemy_hero_id = 1020;
  if not found or stored.decided_matches <> 10 or stored.decided_switches <> 10 or stored.wins <> 4
     or stored.matches <> 11 or stored.switches <> 11 then
    raise exception 'a switch by team 2 must take team 2''s result, and be credited to the enemy''s pick of that second: %', stored;
  end if;
  if not exists (select 1 from public.hero_switch_ins where half_season = 997 and hero_id = 1034 and enemy_hero_id = 1015)
     or not exists (select 1 from public.hero_switch_ins where half_season = 997 and hero_id = 1015 and enemy_hero_id = 1033) then
    raise exception 'a switch must be credited to every enemy hero on the field';
  end if;
  raise notice 'ok: a switch is credited to every enemy hero on the field, whichever team made it';

  select * into read_back
  from jsonb_to_recordset(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins')
       as r(half_season numeric, hero_id integer, enemy_hero_id integer, decided_matches integer, decided_switches integer, wins integer)
  where r.half_season = 997 and r.hero_id = 1020;
  if not found or read_back.decided_matches <> 11 or read_back.decided_switches <> 11 or read_back.wins <> 7 then
    raise exception 'the reader must return the switch-in that passes the gate: %', read_back;
  end if;
  select * into stored from public.hero_switch_ins where half_season = 997 and hero_id = 1017 and enemy_hero_id = 1033;
  if not found or stored.decided_matches <> 9 or stored.recorders <> 3 then
    raise exception 'the nine-match fixture must be stored with three recorders: %', stored;
  end if;
  if exists (
    select 1 from jsonb_to_recordset(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins') as r(half_season numeric, hero_id integer)
    where r.half_season = 997 and r.hero_id = 1017
  ) then
    raise exception 'nine matches from three players must stay hidden';
  end if;
  raise notice 'ok: under 10 matches stays hidden whoever recorded it';
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

-- Issue 666: the players behind a switch-in are the uploaders of the match's timelines, and a match whose
-- timelines carry no uploader falls back to the scoreboard's. Each half-season holds ten decided matches
-- of the same switch (1011 to 1020 against 1033).
--  * 996: one player recorded every scoreboard; two others recorded the timelines (5 and 4 matches) and
--    the tenth match's timelines carry no recorder. Three players, the busiest with 5: the reader returns it.
--  * 995: two players recorded the scoreboards, one other recorded every timeline. One player: the reader
--    must hide it, though counting the scoreboard recorders would have let it through.
do $$
declare
  hs numeric;
  n integer;
  played timestamptz;
  board_recorder text;
  timeline_recorder text;
  stored record;
begin
  if exists (select 1 from public.participants where half_season in (995, 996)) then
    raise exception 'test half-seasons already exist';
  end if;

  foreach hs in array array[996, 995]::numeric[] loop
    for n in 1..10 loop
      played := now() - make_interval(hours => n);
      board_recorder := case when hs = 996 then 'tst-rec-board' else 'tst-rec-board-' || (n % 2) end;
      timeline_recorder := case
        when hs = 995 then 'tst-rec-timeline-c'
        when n <= 5 then 'tst-rec-timeline-a'
        when n <= 9 then 'tst-rec-timeline-b'
      end;

      perform public.record_match_participants('tst-rec-' || hs || '-' || n, hs, played, board_recorder,
        jsonb_build_array(
          jsonb_build_object('uid', 'tst-rec-' || hs || '-' || n || '-1', 'name', 'tst-rec-' || hs || '-' || n || '-1',
                             'team', 1, 'hero_id', 1011, 'kills', 1, 'deaths', 1, 'assists', 1, 'is_win', true),
          jsonb_build_object('uid', 'tst-rec-' || hs || '-' || n || '-2', 'name', 'tst-rec-' || hs || '-' || n || '-2',
                             'team', 2, 'hero_id', 1033, 'kills', 1, 'deaths', 1, 'assists', 1, 'is_win', false)),
        1::smallint, null);

      if public.record_match_hero_timelines('tst-rec-' || hs || '-' || n, played,
           '[{"team": 1, "picks": [{"hero_id": 1011, "at_second": 0}, {"hero_id": 1020, "at_second": 100}]},
             {"team": 2, "picks": [{"hero_id": 1033, "at_second": 0}]}]'::jsonb,
           timeline_recorder) <> 2 then
        raise exception 'both timelines of match % in half-season % must be stored', n, hs;
      end if;
    end loop;
  end loop;

  if exists (select 1 from public.match_hero_timelines where fingerprint like 'tst-rec-%' and recorded_by is null and fingerprint not like '%-10')
     or not exists (select 1 from public.match_hero_timelines where fingerprint = 'tst-rec-996-10' and recorded_by is null) then
    raise exception 'the writer must store the recorder it was given, and a null when it was given none';
  end if;
  if exists (select 1 from public.match_hero_timelines where recorded_by = 'tst-rec-board') then
    raise exception 'a timeline must not take the scoreboard recorder when it was given its own';
  end if;
  raise notice 'ok: the timeline writer stores the recorder it is given';

  perform public.rebuild_hero_switch_in_aggregates(996);
  perform public.rebuild_hero_switch_in_aggregates(995);

  select * into stored from public.hero_switch_ins where half_season = 996 and hero_id = 1020 and enemy_hero_id = 1033;
  if not found or stored.decided_matches <> 10 or stored.recorders <> 3 or stored.top_recorder_matches <> 5 then
    raise exception 'the players must be the timeline uploaders, with the scoreboard recorder standing in for a match whose timelines carry none: %', stored;
  end if;
  raise notice 'ok: the switch-in players are the timeline uploaders, falling back to the scoreboard recorder';

  select * into stored from public.hero_switch_ins where half_season = 995 and hero_id = 1020 and enemy_hero_id = 1033;
  if not found or stored.decided_matches <> 10 or stored.recorders <> 1 or stored.top_recorder_matches <> 10 then
    raise exception 'two scoreboard recorders must not count as two players when one player uploaded every timeline: %', stored;
  end if;
  raise notice 'ok: the scoreboard recorders are not counted when the timelines have their own';

  if not exists (
    select 1 from jsonb_to_recordset(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins') as r(half_season numeric, hero_id integer)
    where r.half_season = 996 and r.hero_id = 1020
  ) then
    raise exception 'ten matches from three timeline uploaders must be returned';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins') as r(half_season numeric, hero_id integer)
    where r.half_season = 995 and r.hero_id = 1020
  ) then
    raise exception 'ten matches from one timeline uploader must stay hidden';
  end if;
  raise notice 'ok: the two-player gate counts the timeline uploaders';

  if has_column_privilege('anon', 'public.match_hero_timelines', 'recorded_by', 'select')
     or has_column_privilege('authenticated', 'public.match_hero_timelines', 'recorded_by', 'select') then
    raise exception 'the timeline recorder must not be readable by the publishable key';
  end if;
  raise notice 'ok: the timeline recorder is closed to the publishable key';
end
$$;

rollback;
