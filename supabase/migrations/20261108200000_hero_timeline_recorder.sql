-- Issue 666: count the players behind a switch-in from whoever uploaded the match's timelines. The
-- switch-in counts (issue 655) credited each match to the user whose upload stored its scoreboard,
-- because `match_hero_timelines` kept no uploader. When an older overlay sent the scoreboard and a newer
-- one the timelines, the wrong person was credited, and the two-player gate could pass too early.
--
-- `match_hero_timelines.recorded_by` is the same keyed hash `participants.recorded_by` holds, never a
-- username. It is null for rows stored before this migration and for an upload that sends none, and a
-- null is read as the scoreboard's recorder, so nothing already stored changes meaning. Retention,
-- row level security and grants are unchanged: the table is still closed to `anon` and `authenticated`.
--
-- The writer gains a fourth argument that defaults to null. The deployed Edge Function sends three
-- named arguments and keeps working until it is redeployed with the fourth. A plain `create or
-- replace` with an extra argument would leave both overloads in place and PostgREST could not choose
-- between them (PGRST203), so the old function is dropped and the new one created in this migration.
-- The body is the one from `20261108180000_match_hero_timelines.sql` plus the recorder.
--
-- `fill_hero_switch_in_aggregates` is restated from `20261108190000_hero_switch_in_aggregates.sql`
-- with one change: a match's recorder is the one that stored its timelines when it has one, and the one
-- that stored its scoreboard otherwise. That recorder feeds both the distinct-player count and the
-- busiest player's share. `purge_expired_participants` is not touched.

alter table public.match_hero_timelines add column if not exists recorded_by text;

drop function if exists public.record_match_hero_timelines(text, timestamptz, jsonb);

-- Stores one match's hero timelines and the hash of the user who uploaded them, and returns how many
-- player timelines it wrote. The match must already be in `participants`, so timelines can never be
-- stored for a match nobody recorded.
--
-- Safe to repeat: timelines are written once per match (the first uploader's wins, and so is its
-- recorder), so two uploaders of one match store them once. A timeline is stored whole or not at all:
-- it needs a team from 0 to 9, 1 to 20 picks, each with a hero id and a second from 0 to 7200, and
-- seconds that never go back. A list of more than 12 players is not a real one and none of it is stored.
create function public.record_match_hero_timelines(
  p_fingerprint text,
  p_played_at timestamptz,
  p_hero_timelines jsonb,
  p_recorded_by text default null
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  match_half_season numeric;
  match_played_at timestamptz;
  written integer := 0;
begin
  if jsonb_typeof(p_hero_timelines) is distinct from 'array' or jsonb_array_length(p_hero_timelines) not between 1 and 12 then
    return 0;
  end if;

  -- A different lock seed from the three other match writers (seeds 0, 1 and 2), so none of them waits on another.
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint, 3));

  -- The same 4 minute window `record_match_participants` uses to call two uploads one match.
  select p.half_season, p.played_at into match_half_season, match_played_at
  from public.participants p
  where p.fingerprint = p_fingerprint
    and p.played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
  order by abs(extract(epoch from p.played_at - p_played_at)), p.id
  limit 1;

  if not found then
    return 0;
  end if;

  if exists (
    select 1 from public.match_hero_timelines t
    where t.fingerprint = p_fingerprint and t.played_at = match_played_at
  ) then
    return 0;
  end if;

  with picks as (
    select t.ord as timeline_no,
           public.json_whole_number(t.timeline -> 'team', 0, 9) as team,
           p.ord as pick_no,
           public.json_whole_number(p.pick -> 'hero_id', 1, 2147483647) as hero_id,
           public.json_whole_number(p.pick -> 'at_second', 0, 7200) as at_second
    from jsonb_array_elements(p_hero_timelines) with ordinality as t(timeline, ord)
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(t.timeline -> 'picks') = 'array' then t.timeline -> 'picks' else '[]'::jsonb end
    ) with ordinality as p(pick, ord)
  ),
  ordered as (
    select k.timeline_no, k.team, k.pick_no, k.hero_id, k.at_second,
           k.at_second >= coalesce(lag(k.at_second) over (partition by k.timeline_no order by k.pick_no), 0) as in_order
    from picks k
  ),
  whole as (
    select o.timeline_no
    from ordered o
    group by o.timeline_no
    having count(*) between 1 and 20
      and bool_and(o.team is not null and o.hero_id is not null and o.at_second is not null and o.in_order)
  ),
  inserted as (
    insert into public.match_hero_timelines
      (fingerprint, half_season, played_at, team, timeline_no, pick_no, hero_id, at_second, recorded_by)
    select p_fingerprint, match_half_season, match_played_at, o.team, o.timeline_no, o.pick_no, o.hero_id, o.at_second, p_recorded_by
    from ordered o
    join whole w on w.timeline_no = o.timeline_no
    on conflict (fingerprint, played_at, timeline_no, pick_no) do nothing
    returning timeline_no
  )
  select count(distinct i.timeline_no) into written from inserted i;

  return written;
end
$$;

-- Writes the counts for one half-season from a single read of its raw rows, in one statement. The
-- caller has emptied the half-season's rows first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later), which
-- is also how `match_hero_timelines` keys it. Mode belongs to the match, so it is read once per match
-- rather than trusted line by line, and so does the recorder: the one whose upload stored its timelines,
-- or the one whose upload stored its scoreboard when the timelines carry none. A timeline's team is the
-- scoreboard team (the upload dropped any team that did not match it).
create or replace function public.fill_hero_switch_in_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with timeline_recorders as materialized (
    select k.fingerprint, k.played_at, min(k.recorded_by) as recorder
    from public.match_hero_timelines k
    where k.half_season = p_half_season
    group by k.fingerprint, k.played_at
  ),
  match_rows as materialized (
    select p.fingerprint, p.played_at,
           dense_rank() over (order by p.fingerprint, p.played_at) as match_no,
           coalesce(min(p.play_mode_id), -1)::smallint as play_mode_id,
           coalesce(min(r.recorder), min(p.recorded_by)) as recorder
    from public.participants p
    left join timeline_recorders r on r.fingerprint = p.fingerprint and r.played_at = p.played_at
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

-- Postgres grants EXECUTE to everyone on a new function; these are for the Edge Function's service role.
revoke execute on function public.record_match_hero_timelines(text, timestamptz, jsonb, text) from public, anon, authenticated;
grant execute on function public.record_match_hero_timelines(text, timestamptz, jsonb, text) to service_role;

-- Restated with the same signature, so its grants are stated again.
revoke execute on function public.fill_hero_switch_in_aggregates(numeric) from public, anon, authenticated;
grant execute on function public.fill_hero_switch_in_aggregates(numeric) to service_role;
