-- Issue 667: count a hero the game splits by role (Deadpool) as one hero in the switch-in counts. The
-- game gives Deadpool a hero id per role form (10571 Vanguard, 10572 Duelist, 10573 Strategist), and the
-- scoreboard stores the form played, so a timeline's picks carry those ids too. The fill (issue 655)
-- compared and stored raw ids, which went wrong in two ways:
--  * Two picks in a row of different forms counted as a switch to Deadpool. The overlay already folds
--    back-to-back picks of one hero into a single pick, so today this can only arrive from an overlay
--    that does not, but the database should not depend on that.
--  * Deadpool's forms were stored as separate heroes, so the website had to add their rows. A match with
--    a switch into one form and, later, a switch into another reached the sum twice, and so did a
--    switch against two enemy Deadpools in different forms. A row cannot be told from another match's
--    once it is a count, so the merge has to happen here, before counting.
--
-- `fill_hero_switch_in_aggregates` is restated from `20261108200000_hero_timeline_recorder.sql` with
-- one change: every hero id, the one switched to, the previous pick and the enemy's pick on the field,
-- is read as its base id from `hero_game_roles` (Deadpool's three forms share 1057; every other
-- hero is its own base; an id the table does not know is kept as it is). Nothing else changes: the
-- same switch rule, the same credit to each distinct enemy hero, the same result and recorder logic.
--
-- The stored rows of Deadpool change from three hero ids to 1057 at the next rebuild (hourly), and a
-- frozen half-season is never rebuilt. None exists with timelines yet. Signature, security and grants
-- are the same as before.

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
  -- the result of the team that made it (null when the team has none). A hero is its base id, so a
  -- change between two role forms of one hero is no switch. A switch of a team the scoreboard does not
  -- know is dropped here.
  switches as materialized (
    select s.fingerprint, s.played_at, s.team, s.timeline_no, s.pick_no, s.hero_id, s.at_second, t.is_win
    from (
      select k.fingerprint, k.played_at, k.team, k.timeline_no, k.pick_no,
             coalesce(h.base_game_id, k.hero_id) as hero_id, k.at_second,
             lag(coalesce(h.base_game_id, k.hero_id)) over (
               partition by k.fingerprint, k.played_at, k.timeline_no order by k.pick_no
             ) as previous_hero_id
      from public.match_hero_timelines k
      left join public.hero_game_roles h on h.game_id = k.hero_id
      where k.half_season = p_half_season
    ) s
    join teams t on t.fingerprint = s.fingerprint and t.played_at = s.played_at and t.team = s.team
    where s.previous_hero_id is not null and s.hero_id <> s.previous_hero_id
  ),
  -- Each switch once per distinct enemy hero on the field at its second: the latest pick of each enemy
  -- timeline at or before it. Two enemy players on different forms of one hero are that hero once. A
  -- switch that finds no enemy pick has no row. The lookup reads the table, not a CTE, so its unique
  -- index (fingerprint, played_at, ...) finds one match's picks instead of the rebuild scanning every
  -- pick of the half-season once per switch.
  credits as (
    select distinct s.fingerprint, s.played_at, s.timeline_no, s.pick_no, s.hero_id,
           e.hero_id as enemy_hero_id, s.is_win
    from switches s
    cross join lateral (
      select distinct on (k.timeline_no) coalesce(h.base_game_id, k.hero_id) as hero_id
      from public.match_hero_timelines k
      left join public.hero_game_roles h on h.game_id = k.hero_id
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

-- Restated with the same signature, so its grants are stated again.
revoke execute on function public.fill_hero_switch_in_aggregates(numeric) from public, anon, authenticated;
grant execute on function public.fill_hero_switch_in_aggregates(numeric) to service_role;
