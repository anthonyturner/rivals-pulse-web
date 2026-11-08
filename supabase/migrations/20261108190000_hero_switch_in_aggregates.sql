-- Issue 655: how often a hero change is made while a given enemy hero is on the field, and how often
-- the team that made it wins, per half-season and game mode, kept as anonymous counts that outlive the
-- raw rows. No uid, name, fingerprint or per-player row is stored here. Nothing is published by this
-- migration except through `read_hero_switch_ins`.
--
-- A separate family, as `hero_pair_aggregates` is: it owns its rebuild and freeze and does not touch
-- the other families. `recompute_hero_switch_in_aggregates` rebuilds every half-season that still has
-- raw rows and is not frozen, from scratch, so a late result or a `forget_player` shows up on the next
-- run and running it twice changes nothing. `purge_expired_participants` calls
-- `freeze_hero_switch_in_aggregates` just before it deletes, which rebuilds each half-season that is
-- going one last time and marks it frozen. A frozen half-season is never rebuilt again.
--
-- What is counted, from `match_hero_timelines` (issue 654) and the scoreboard:
--  * A switch is a pick that follows a player's first pick and names a different hero than the pick
--    before it. A player's first pick is not a switch.
--  * It is credited, once, to every distinct enemy hero on the field at its `at_second`: for each
--    timeline of a team other than the switching team, the latest pick at or before that second. An
--    enemy player with no pick yet is not on the field. A switch with no enemy hero known is credited
--    to nobody. The same enemy hero played by two enemy players is one credit.
--  * Its outcome is the switching team's result in `participants`, read as `fill_hero_pair_aggregates`
--    reads a team's result. A switch whose team has no result is kept in `switches` and left out of
--    every `decided_` figure, as the pair family splits `matches` and `decided_matches`.
--  * The first uploader's timelines are all a match has, and a team that failed the upload's scoreboard
--    check was dropped, so a match can have the timelines of one team only. A switch needs its own
--    team's timeline (it is one of its picks) and an enemy team's timeline (an enemy hero to credit it
--    to); a switch that lacks either is skipped without affecting the rest of the match.
--
-- Recorder diversity. A row records how many distinct recorders (the user whose upload stored the
-- match's scoreboard, as in the other families; the timelines carry no recorder of their own) its
-- matches came from and how many matches the busiest one did: counts only, never who.
-- `read_hero_switch_ins` returns a row only when `hero_figure_qualifies` passes for it, per half-season
-- and mode, checked before any modes are summed so one list of modes cannot be subtracted from another
-- to recover a hidden one. Unlike the pair tables, the rows are kept whatever their size and the gate
-- is applied only when they are read, as for the kill feed.
--
-- Additive: no existing table is touched. `purge_expired_participants` is restated with the same
-- signature (a body change) and calls the new freeze after the other families' own.

-- One row per half-season that has been aggregated here.
create table if not exists public.hero_switch_in_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set by the purge when it freezes the half-season. Null while the half-season is still rebuilt.
  frozen_at timestamptz
);

-- Per half-season, game mode, the hero switched to and the enemy hero it was credited to. play_mode_id
-- is the match's mode (0 Quick Match, 1 Competitive, 2 Arcade, 3 Practice) or -1 when the game did not
-- say. hero_id is the game's hero id, so a hero the game splits by role (Deadpool) is several rows.
--
-- switches is the credits (one switch faced with two enemy heroes is two) and matches the distinct
-- matches they came from, whatever the result. The decided_ figures count only credits whose
-- switching team has a result, and wins the credits whose team won, so a win rate is
-- wins / decided_switches.
create table if not exists public.hero_switch_ins (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  hero_id integer not null,
  enemy_hero_id integer not null,
  matches integer not null,
  decided_matches integer not null,
  switches integer not null,
  decided_switches integer not null,
  wins integer not null,
  -- Distinct recorders of the decided matches, and the decided matches of the one who recorded most
  -- of them. Both are 0 where no match is decided yet.
  recorders integer not null,
  top_recorder_matches integer not null,
  primary key (half_season, play_mode_id, hero_id, enemy_hero_id),
  constraint hero_switch_ins_counts_consistent check (
    wins <= decided_switches and decided_switches <= switches
    and decided_matches <= matches and matches <= switches and decided_matches <= decided_switches
    and matches >= 1
    and recorders between 0 and decided_matches and top_recorder_matches between 0 and decided_matches
  )
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key. The website
-- reads these counts through `read_hero_switch_ins` only.
alter table public.hero_switch_in_aggregate_half_seasons enable row level security;
alter table public.hero_switch_ins enable row level security;
revoke all on public.hero_switch_in_aggregate_half_seasons from anon, authenticated;
revoke all on public.hero_switch_ins from anon, authenticated;
grant select, insert, update, delete on public.hero_switch_in_aggregate_half_seasons to service_role;
grant select, insert, update, delete on public.hero_switch_ins to service_role;

-- Writes the counts for one half-season from a single read of its raw rows, in one statement. The
-- caller has emptied the half-season's rows first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later), which
-- is also how `match_hero_timelines` keys it. Mode belongs to the match, so it is read once per match
-- rather than trusted line by line, and so does the recorder: the one whose upload stored its lines.
-- A timeline's team is the scoreboard team (the upload dropped any team that did not match it).
create or replace function public.fill_hero_switch_in_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with match_rows as materialized (
    select p.fingerprint, p.played_at,
           dense_rank() over (order by p.fingerprint, p.played_at) as match_no,
           coalesce(min(p.play_mode_id), -1)::smallint as play_mode_id,
           min(p.recorded_by) as recorder
    from public.participants p
    where p.half_season = p_half_season
    group by p.fingerprint, p.played_at
  ),
  -- A team's result in a match: the result its lines agree on, null when none has one or they differ.
  teams as materialized (
    select p.fingerprint, p.played_at, p.team,
           case when bool_and(p.is_win) then true when not bool_or(p.is_win) then false end as is_win
    from public.participants p
    where p.half_season = p_half_season and p.team is not null
    group by p.fingerprint, p.played_at, p.team
  ),
  -- A pick that follows the player's first and names a different hero than the pick before it, with
  -- the result of the team that made it (null when the team has none). A switch of a team the
  -- scoreboard does not know is dropped here.
  switches as materialized (
    select s.fingerprint, s.played_at, s.team, s.timeline_no, s.pick_no, s.hero_id, s.at_second, t.is_win
    from (
      select k.fingerprint, k.played_at, k.team, k.timeline_no, k.pick_no, k.hero_id, k.at_second,
             lag(k.hero_id) over (
               partition by k.fingerprint, k.played_at, k.timeline_no order by k.pick_no
             ) as previous_hero_id
      from public.match_hero_timelines k
      where k.half_season = p_half_season
    ) s
    join teams t on t.fingerprint = s.fingerprint and t.played_at = s.played_at and t.team = s.team
    where s.previous_hero_id is not null and s.hero_id <> s.previous_hero_id
  ),
  -- Each switch once per distinct enemy hero on the field at its second: the latest pick of each enemy
  -- timeline at or before it. A switch that finds no enemy pick has no row. The lookup reads the
  -- table, not a CTE, so its unique index (fingerprint, played_at, ...) finds one match's picks
  -- instead of the rebuild scanning every pick of the half-season once per switch.
  credits as (
    select distinct s.fingerprint, s.played_at, s.timeline_no, s.pick_no, s.hero_id,
           e.hero_id as enemy_hero_id, s.is_win
    from switches s
    cross join lateral (
      select distinct on (k.timeline_no) k.hero_id
      from public.match_hero_timelines k
      where k.fingerprint = s.fingerprint and k.played_at = s.played_at
        and k.team <> s.team and k.at_second <= s.at_second
      order by k.timeline_no, k.pick_no desc
    ) e
  ),
  per_recorder as (
    -- One row per recorder: the recorder exists only here, to count them and find the busiest.
    select m.play_mode_id, c.hero_id, c.enemy_hero_id, m.recorder,
           count(distinct m.match_no) as matches,
           count(distinct m.match_no) filter (where c.is_win is not null) as decided_matches,
           count(*) as switches,
           count(*) filter (where c.is_win is not null) as decided_switches,
           count(*) filter (where c.is_win) as wins
    from credits c
    join match_rows m on m.fingerprint = c.fingerprint and m.played_at = c.played_at
    group by m.play_mode_id, c.hero_id, c.enemy_hero_id, m.recorder
  )
  insert into public.hero_switch_ins
    (half_season, play_mode_id, hero_id, enemy_hero_id, matches, decided_matches, switches, decided_switches,
     wins, recorders, top_recorder_matches)
  select p_half_season, r.play_mode_id, r.hero_id, r.enemy_hero_id,
         sum(r.matches)::integer, sum(r.decided_matches)::integer,
         sum(r.switches)::integer, sum(r.decided_switches)::integer, sum(r.wins)::integer,
         (count(*) filter (where r.decided_matches > 0))::integer, max(r.decided_matches)::integer
  from per_recorder r
  group by r.play_mode_id, r.hero_id, r.enemy_hero_id
$$;

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts the purge has already preserved).
create or replace function public.rebuild_hero_switch_in_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('hero_switch_in_aggregates', 0));

  if exists (
    select 1 from public.hero_switch_in_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.participants where half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.hero_switch_ins where half_season = p_half_season;

  perform public.fill_hero_switch_in_aggregates(p_half_season);

  insert into public.hero_switch_in_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen. Returns
-- how many it rebuilt. One transaction, so a reader never sees half a rebuild.
create or replace function public.recompute_hero_switch_in_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct p.half_season from public.participants p order by 1 loop
    if public.rebuild_hero_switch_in_aggregates(h) then
      rebuilt := rebuilt + 1;
    end if;
  end loop;
  return rebuilt;
end
$$;

-- Rebuilds and freezes every half-season about to lose raw rows. Called by
-- `purge_expired_participants` BEFORE it deletes anything, which is the only thing that keeps these
-- counts when the raw rows go: any later migration that restates the purge must keep calling it.
-- The retention rule holds for a half-season when it holds for its oldest row, so it is asked once
-- per half-season.
create or replace function public.freeze_hero_switch_in_aggregates() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.rebuild_hero_switch_in_aggregates(due.half_season, true)
  from (
    select p.half_season from public.participants p
    group by p.half_season
    having public.participants_past_retention(p.half_season, min(p.played_at))
  ) due;
end
$$;

-- Freezes every aggregate family before deleting; a later restatement must keep calling every freeze.
-- Restated from `20261108180000_match_hero_timelines.sql` with one more freeze, before the first delete,
-- because the timelines this family reads go in the same purge. Returns the scoreboard rows deleted.
create or replace function public.purge_expired_participants() returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.rebuild_hero_aggregates(due.half_season, true)
  from (
    select p.half_season from public.participants p
    group by p.half_season
    having public.participants_past_retention(p.half_season, min(p.played_at))
  ) due;

  perform public.freeze_extended_aggregates();
  perform public.freeze_hero_pair_aggregates();
  perform public.freeze_triple_support_aggregates();
  perform public.freeze_hero_switch_in_aggregates();

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;

  delete from public.match_hero_kills k
  where public.participants_past_retention(k.half_season, k.played_at);

  delete from public.match_hero_timelines t
  where public.participants_past_retention(t.half_season, t.played_at);

  return removed;
end
$$;

-- The one way the website reads the switch-ins. It runs as its owner and returns one jsonb value (so
-- PostgREST's 1000-row page limit never cuts the answer short): one entry per half-season, hero
-- switched to and enemy hero, summed over the modes asked for. A (half-season, mode) row is included
-- only when `hero_figure_qualifies` passes for its own decided matches and recorders, checked before
-- anything is summed, so no list of modes can be subtracted from another to recover a hidden one. Recorder
-- counts are not returned.
create or replace function public.read_hero_switch_ins(
  p_play_mode_ids smallint[] default array[0, 1]::smallint[]
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'switch_ins', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', r.half_season,
               'hero_id', r.hero_id,
               'enemy_hero_id', r.enemy_hero_id,
               'decided_matches', r.decided_matches,
               'decided_switches', r.decided_switches,
               'wins', r.wins)
             order by r.half_season, r.hero_id, r.enemy_hero_id)
      from (
        select x.half_season, x.hero_id, x.enemy_hero_id,
               sum(x.decided_matches)::integer as decided_matches,
               sum(x.decided_switches)::integer as decided_switches,
               sum(x.wins)::integer as wins
        from public.hero_switch_ins x
        where x.play_mode_id = any (p_play_mode_ids)
          and public.hero_figure_qualifies(x.decided_matches, x.recorders, x.top_recorder_matches)
        group by x.half_season, x.hero_id, x.enemy_hero_id
      ) r
    ), '[]'::jsonb)
  )
$$;

-- The gate is the privacy rule, so it is exercised on fixtures in a half-season that does not exist:
-- a row of one recorder (mode 0) and a row of three (mode 1), each with 10 matches, and a row of three
-- recorders with 9 matches (mode 3). Only the second may come back, alone and in a list of all three. The fixtures are rolled back by the sentinel
-- exception (P0042). If the fixtures cannot be written, the check is skipped with a warning; an error
-- from the reader itself, or a failed assertion, fails the push.
do $$
declare
  written boolean := false;
  one_recorder_returned boolean;
  nine_matches_returned boolean;
  three_recorders_matches integer;
  all_modes_matches integer;
begin
  begin
    begin
      insert into public.hero_switch_ins
        (half_season, play_mode_id, hero_id, enemy_hero_id, matches, decided_matches, switches, decided_switches,
         wins, recorders, top_recorder_matches)
      values (99.0, 0, 1, 2, 10, 10, 12, 12, 6, 1, 10),
             (99.0, 1, 1, 2, 10, 10, 12, 12, 6, 3, 5),
             (99.0, 3, 1, 2, 9, 9, 9, 9, 4, 3, 3);
      written := true;
    exception when others then
      raise warning 'hero switch-in gate check skipped (%)', sqlerrm;
    end;

    if written then
      -- Only the fixture half-season is read back: real half-seasons come back in the same answer.
      select exists (
        select 1 from jsonb_array_elements(public.read_hero_switch_ins(array[0]::smallint[]) -> 'switch_ins') e
        where (e ->> 'half_season')::numeric = 99.0
      ) into one_recorder_returned;
      select exists (
        select 1 from jsonb_array_elements(public.read_hero_switch_ins(array[3]::smallint[]) -> 'switch_ins') e
        where (e ->> 'half_season')::numeric = 99.0
      ) into nine_matches_returned;
      select coalesce(sum((e ->> 'decided_matches')::integer), 0) into three_recorders_matches
        from jsonb_array_elements(public.read_hero_switch_ins(array[1]::smallint[]) -> 'switch_ins') e
        where (e ->> 'half_season')::numeric = 99.0;
      select coalesce(sum((e ->> 'decided_matches')::integer), 0) into all_modes_matches
        from jsonb_array_elements(public.read_hero_switch_ins(array[0, 1, 3]::smallint[]) -> 'switch_ins') e
        where (e ->> 'half_season')::numeric = 99.0;

      raise exception 'roll back the gate fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert not one_recorder_returned, 'a one-recorder row must be hidden';
    assert not nine_matches_returned, 'a row under 10 matches must be hidden however many players recorded it';
    assert three_recorders_matches = 10, 'a row that passes must be returned';
    assert all_modes_matches = 10, 'only the row that passes may be returned, whatever modes are asked for';
  end if;
end
$$;

-- Postgres grants EXECUTE to everyone on a new function. The reader is for the publishable key (the
-- `anon` role) and the service role, as `read_hero_pairs` is; everything else is for the service role
-- and the scheduler only.
revoke execute on function public.fill_hero_switch_in_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_hero_switch_in_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_hero_switch_in_aggregates() from public, anon, authenticated;
revoke execute on function public.freeze_hero_switch_in_aggregates() from public, anon, authenticated;
revoke execute on function public.purge_expired_participants() from public, anon, authenticated;
revoke execute on function public.read_hero_switch_ins(smallint[]) from public, anon, authenticated;
grant execute on function public.fill_hero_switch_in_aggregates(numeric) to service_role;
grant execute on function public.rebuild_hero_switch_in_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_hero_switch_in_aggregates() to service_role;
grant execute on function public.freeze_hero_switch_in_aggregates() to service_role;
grant execute on function public.purge_expired_participants() to service_role;
grant execute on function public.read_hero_switch_ins(smallint[]) to anon, service_role;

-- Fill the table now, so the first read needs no waiting. Half-seasons whose raw rows are already
-- purged cannot be filled.
select public.recompute_hero_switch_in_aggregates();

-- Rebuild hourly, at a different minute from the other families, where pg_cron is already installed.
-- The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-hero-switch-in-aggregates';
    perform cron.schedule('recompute-hero-switch-in-aggregates', '53 * * * *', 'select public.recompute_hero_switch_in_aggregates()');
  else
    raise warning 'pg_cron is not installed: hero switch-ins are rebuilt only when the purge freezes a half-season';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): hero switch-ins are rebuilt only when the purge freezes a half-season', sqlerrm;
end
$$;
