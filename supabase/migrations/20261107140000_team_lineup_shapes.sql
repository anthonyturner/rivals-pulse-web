-- Issue 126: how often each team line-up shape (Vanguard-Duelist-Strategist count of one team, such as
-- 1-2-3) is played and how often it wins, per half-season, game mode and rank bucket, kept as
-- anonymous counts that outlive the raw rows. No uid, name, fingerprint, hero or per-player row is
-- stored here. Nothing is published by this migration.
--
-- Part of the triple-support family, not a family of its own. A shape needs exactly what the trio
-- rebuild already computes: the role of every hero on a team (`hero_game_roles`), the same duplicate
-- handling, the same "unresolved team" rule, the same totals (classified and unclassified teams, and
-- the recorder figures of the privacy gate). So `fill_triple_support_aggregates` writes the shapes in
-- the same statement as the trios and totals, and the pick rate's denominator (`classified_teams`) is
-- by construction the sum of the shapes' teams. Consequences worth knowing:
--  * `rebuild_triple_support_aggregates` also empties `team_lineup_shapes` and the existing
--    `freeze_triple_support_aggregates` freezes it, so `purge_expired_participants` is not restated
--    and cannot lose a freeze call.
--  * The hourly job `recompute-triple-support-aggregates` (minute 47) rebuilds shapes too; there is no
--    second job.
--  * A half-season frozen before this migration has no shapes, and cannot get them: its raw rows are gone.
--
-- A team is classified when every one of its players' heroes has a role in `hero_game_roles`. Hero id 0
-- ("no hero recorded"), Deadpool's base id 1057 (the game reports his role forms, 10571 to 10573) and
-- any id not in the table are unknown: the team is counted as unclassified, never as a shape and never
-- silently dropped. `hero_id` is the hero a player ended the match on. The number of players on a team
-- is not checked (Competitive and Quick Match are six a side).
--
-- Rank. `rank_bucket` is -1 (unknown) on every row today, as in the other families.
--
-- Recorder diversity and the minimum. The recorder gate is the trio reader's, on the shared totals.
-- Every shape is stored, because a shape is only three small numbers; the minimum
-- (`team_lineup_min_teams()`) is applied by the reader, which withholds the counts of a shape under it
-- and says so (`enough_data = false`), so a thin shape is published as "not enough data yet" with no figures.

-- The smallest number of teams a shape needs, over its half-season, before its counts are read.
create or replace function public.team_lineup_min_teams() returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

-- Per half-season, game mode, rank bucket and shape. play_mode_id and rank_bucket are as in
-- `triple_support_trios`. One occurrence is one classified team in a match with a result; wins is the
-- occurrences that won.
create table if not exists public.team_lineup_shapes (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  rank_bucket smallint not null,
  vanguards smallint not null,
  duelists smallint not null,
  strategists smallint not null,
  teams integer not null,
  wins integer not null,
  primary key (half_season, play_mode_id, rank_bucket, vanguards, duelists, strategists),
  constraint team_lineup_shapes_rank_bucket_known check (rank_bucket >= -1),
  constraint team_lineup_shapes_counts_known check (vanguards >= 0 and duelists >= 0 and strategists >= 0),
  constraint team_lineup_shapes_counts_consistent check (teams > 0 and wins between 0 and teams)
);

-- Same posture as the other count tables: RLS on, no policy, nothing for the publishable key. The
-- website reads these counts through `read_team_lineup_shapes` only.
alter table public.team_lineup_shapes enable row level security;
revoke all on public.team_lineup_shapes from anon, authenticated;
grant select, insert, update, delete on public.team_lineup_shapes to service_role;

-- Restates the fill of 20261107120000 with the shape counts added; the trios and totals it writes are
-- unchanged. Writes all three count tables for one half-season from a single read of its raw rows, in
-- one statement, so they always describe the same set of matches. The caller has emptied the
-- half-season's rows first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later), so an
-- upload of a match that is stored twice would still be one match. Mode belongs to the match, so it
-- is read once per match rather than trusted line by line, and so does the recorder: the one whose
-- upload stored its lines. A scoreboard line is one player in one match, so two lines on a team are
-- two different players.
create or replace function public.fill_triple_support_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with l as materialized (
    select dense_rank() over (order by p.fingerprint, p.played_at) as match_no,
           coalesce(min(p.play_mode_id) over w, -1)::smallint as play_mode_id,
           -- No rank is stored with an upload yet; the recorder's rank bucket goes here.
           (-1)::smallint as rank_bucket,
           min(p.recorded_by) over w as recorder,
           p.team, p.is_win, r.role, r.base_game_id
    from public.participants p
    left join public.hero_game_roles r on r.game_id = p.hero_id
    where p.half_season = p_half_season
    window w as (partition by p.fingerprint, p.played_at)
  ),
  -- One row per team in a match. Its result is the one its lines agree on, null when none has one or
  -- they differ. A team is unresolved when any line has no known role (including no hero at all).
  teams as materialized (
    select l.match_no, l.team, l.play_mode_id, l.rank_bucket,
           case when bool_and(l.is_win) then true when not bool_or(l.is_win) then false end as is_win,
           bool_or(l.role is null) as unresolved,
           count(*) filter (where l.role = 'Vanguard') as vanguards,
           count(*) filter (where l.role = 'Duelist') as duelists,
           count(*) filter (where l.role = 'Strategist') as strategists,
           array_agg(l.base_game_id order by l.base_game_id) filter (where l.role = 'Strategist') as trio
    from l
    where l.team is not null
    group by l.match_no, l.team, l.play_mode_id, l.rank_bucket
  ),
  trios as (
    insert into public.triple_support_trios
      (half_season, play_mode_id, rank_bucket, hero_a, hero_b, hero_c, matches, teams, wins)
    select p_half_season, m.play_mode_id, m.rank_bucket, m.hero_a, m.hero_b, m.hero_c,
           m.matches, m.teams, m.wins
    from (
      select t.play_mode_id, t.rank_bucket, t.trio[1] as hero_a, t.trio[2] as hero_b, t.trio[3] as hero_c,
             count(distinct t.match_no) as matches,
             count(*) as teams,
             count(*) filter (where t.is_win) as wins,
             -- A match has one mode and one rank bucket, so summing over them counts each match once.
             sum(count(distinct t.match_no))
               over (partition by t.trio[1], t.trio[2], t.trio[3]) as half_season_matches
      from teams t
      where t.is_win is not null and not t.unresolved and t.strategists = 3
      group by t.play_mode_id, t.rank_bucket, t.trio[1], t.trio[2], t.trio[3]
    ) m
    where m.half_season_matches >= public.triple_support_min_matches()
    returning 1
  ),
  shapes as (
    insert into public.team_lineup_shapes
      (half_season, play_mode_id, rank_bucket, vanguards, duelists, strategists, teams, wins)
    select p_half_season, t.play_mode_id, t.rank_bucket, t.vanguards::smallint, t.duelists::smallint,
           t.strategists::smallint, count(*), count(*) filter (where t.is_win)
    from teams t
    where t.is_win is not null and not t.unresolved
    group by t.play_mode_id, t.rank_bucket, t.vanguards, t.duelists, t.strategists
    returning 1
  ),
  team_counts as (
    select t.play_mode_id, t.rank_bucket,
           count(*) filter (where not t.unresolved) as classified_teams,
           count(*) filter (where t.unresolved) as unclassified_teams,
           count(*) filter (where not t.unresolved and t.strategists >= 4) as four_plus_teams
    from teams t
    where t.is_win is not null
    group by t.play_mode_id, t.rank_bucket
  ),
  totals as (
    insert into public.triple_support_totals
      (half_season, play_mode_id, rank_bucket, matches, decided_matches, recorders, top_recorder_matches,
       classified_teams, unclassified_teams, four_plus_teams)
    select p_half_season, g.play_mode_id, g.rank_bucket, g.matches, g.decided_matches, g.recorders,
           g.top_recorder_matches,
           coalesce(c.classified_teams, 0), coalesce(c.unclassified_teams, 0), coalesce(c.four_plus_teams, 0)
    from (
      select x.play_mode_id, x.rank_bucket,
             sum(x.matches)::integer as matches, sum(x.decided_matches)::integer as decided_matches,
             count(*)::integer as recorders, max(x.matches)::integer as top_recorder_matches
      from (
        -- One row per recorder: the recorder exists only here, to count them and find the busiest.
        select m.play_mode_id, m.rank_bucket, m.recorder,
               count(*) as matches,
               count(*) filter (where m.decided) as decided_matches
        from (
          select l.match_no, l.play_mode_id, l.rank_bucket, l.recorder, bool_or(l.is_win is not null) as decided
          from l
          group by l.match_no, l.play_mode_id, l.rank_bucket, l.recorder
        ) m
        group by m.play_mode_id, m.rank_bucket, m.recorder
      ) x
      group by x.play_mode_id, x.rank_bucket
    ) g
    left join team_counts c on c.play_mode_id = g.play_mode_id and c.rank_bucket = g.rank_bucket
    returning 1
  )
  select 1
$$;

-- Restates the rebuild of 20261107120000 so it also empties the shapes. Returns false, and changes
-- nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can never wipe
-- counts the purge has already preserved).
create or replace function public.rebuild_triple_support_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('triple_support_aggregates', 0));

  if exists (
    select 1 from public.triple_support_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.participants where half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.triple_support_trios where half_season = p_half_season;
  delete from public.team_lineup_shapes where half_season = p_half_season;
  delete from public.triple_support_totals where half_season = p_half_season;

  perform public.fill_triple_support_aggregates(p_half_season);

  insert into public.triple_support_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- Shapes for a chosen set of modes (Competitive unless asked otherwise), summed over those modes, one
-- row per half-season, rank bucket and shape, with the half-season's classified and unclassified team
-- counts for the same modes. It runs as its owner and reads only the aggregate tables.
--  * A rank bucket of 0 or more is returned only from the (half-season, mode, bucket) rows whose own
--    totals pass `community_bucket_shown`, checked before anything is summed, for the shapes and the
--    team counts alike (see `read_triple_support_trios`). Rank bucket -1 (unknown) is returned ungated.
--  * A shape whose summed teams are under `team_lineup_min_teams()` comes back with `enough_data`
--    false and null teams and wins: its figures are withheld, its existence is not.
--  * A half-season and bucket with no shape row (only unclassified teams, or one frozen before this
--    migration, which has totals but no shapes) comes back as a single row with null shape columns,
--    so its team counts are not dropped.
-- classified_teams is the denominator of a shape's pick rate. The rows come back in a stable order so
-- a caller can page through them (PostgREST cuts a page at 1000 rows).
create or replace function public.read_team_lineup_shapes(
  p_play_mode_ids smallint[] default array[1]::smallint[]
) returns table (
  half_season numeric,
  rank_bucket smallint,
  vanguards smallint,
  duelists smallint,
  strategists smallint,
  teams integer,
  wins integer,
  enough_data boolean,
  classified_teams integer,
  unclassified_teams integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with shown as (
    select t.half_season, t.play_mode_id, t.rank_bucket, t.classified_teams, t.unclassified_teams
    from public.triple_support_totals t
    where t.play_mode_id = any (p_play_mode_ids)
      and (t.rank_bucket < 0
           or public.community_bucket_shown(t.matches, t.recorders, t.top_recorder_matches))
  ),
  denominators as (
    select s.half_season, s.rank_bucket,
           sum(s.classified_teams) as classified_teams,
           sum(s.unclassified_teams) as unclassified_teams
    from shown s
    group by s.half_season, s.rank_bucket
  ),
  summed as (
    select x.half_season, x.rank_bucket, x.vanguards, x.duelists, x.strategists,
           sum(x.teams) as teams, sum(x.wins) as wins
    from public.team_lineup_shapes x
    join shown s
      on s.half_season = x.half_season and s.play_mode_id = x.play_mode_id and s.rank_bucket = x.rank_bucket
    group by x.half_season, x.rank_bucket, x.vanguards, x.duelists, x.strategists
  )
  select d.half_season, d.rank_bucket, u.vanguards, u.duelists, u.strategists,
         case when u.teams >= public.team_lineup_min_teams() then u.teams::integer end,
         case when u.teams >= public.team_lineup_min_teams() then u.wins::integer end,
         coalesce(u.teams >= public.team_lineup_min_teams(), false),
         d.classified_teams::integer, d.unclassified_teams::integer
  from denominators d
  left join summed u on u.half_season = d.half_season and u.rank_bucket = d.rank_bucket
  order by d.half_season, d.rank_bucket, u.vanguards, u.duelists, u.strategists
$$;

-- Checked when the migration runs, so a wrong constant fails the push.
do $$
begin
  assert public.team_lineup_min_teams() > 0, 'a shape must need at least one team';
end
$$;

-- The gate and the minimum are exercised on fixtures in a half-season that does not exist: a bucket of
-- one recorder (mode 0) and a bucket of three (mode 1). In the second, one shape has 50 teams over the
-- minimum, one has 1 under it. Only the second bucket may come back, the thin shape must come back
-- without figures, and the team counts must not include the first bucket. The fixtures are rolled back by the sentinel
-- exception (P0042). If the fixtures cannot be written, the check is skipped with a warning; an error
-- from the reader itself, or a failed assertion, fails the push.
do $$
declare
  written boolean := false;
  one_recorder_returned boolean;
  rows_returned integer;
  enough_teams integer;
  enough_wins integer;
  thin_enough boolean;
  thin_teams integer;
  both_modes_classified integer;
  min_teams constant integer := public.team_lineup_min_teams();
begin
  begin
    begin
      insert into public.team_lineup_shapes
        (half_season, play_mode_id, rank_bucket, vanguards, duelists, strategists, teams, wins)
      values (99.0, 0, 0, 2, 2, 2, min_teams + 50, 1), (99.0, 1, 0, 2, 2, 2, min_teams + 50, 2),
             (99.0, 1, 0, 1, 2, 3, min_teams - 1, 1);
      insert into public.triple_support_totals
        (half_season, play_mode_id, rank_bucket, matches, decided_matches, recorders, top_recorder_matches,
         classified_teams, unclassified_teams, four_plus_teams)
      values (99.0, 0, 0, 10, 10, 1, 10, min_teams + 50, 0, 0), (99.0, 1, 0, 10, 10, 3, 5, 2 * min_teams + 49, 2, 0);
      written := true;
    exception when others then
      raise warning 'team lineup gate check skipped (%)', sqlerrm;
    end;

    if written then
      select exists (select 1 from public.read_team_lineup_shapes(array[0]::smallint[]) r where r.half_season = 99.0)
        into one_recorder_returned;
      select count(*), max(r.teams) filter (where r.enough_data), max(r.wins) filter (where r.enough_data),
             bool_or(r.enough_data) filter (where r.strategists = 3), max(r.teams) filter (where r.strategists = 3)
        into rows_returned, enough_teams, enough_wins, thin_enough, thin_teams
        from public.read_team_lineup_shapes(array[1]::smallint[]) r
        where r.half_season = 99.0;
      select coalesce(max(r.classified_teams), 0) into both_modes_classified
        from public.read_team_lineup_shapes(array[0, 1]::smallint[]) r
        where r.half_season = 99.0;

      raise exception 'roll back the lineup fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert not one_recorder_returned, 'a one-recorder rank bucket must be hidden';
    assert rows_returned = 2, 'both shapes of the bucket that passes must come back';
    assert enough_teams = min_teams + 50 and enough_wins = 2, 'a shape over the minimum must come back with its counts';
    assert thin_enough = false and thin_teams is null, 'a shape under the minimum must come back without figures';
    assert both_modes_classified = 2 * min_teams + 49, 'team counts must come only from the buckets that pass';
  end if;
end
$$;

-- Postgres grants EXECUTE to everyone on a new function. The reader is for the publishable key (the
-- `anon` role) and the service role; everything else is for the service role and the scheduler only.
revoke execute on function public.team_lineup_min_teams() from public, anon, authenticated;
revoke execute on function public.fill_triple_support_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_triple_support_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.read_team_lineup_shapes(smallint[]) from public, anon, authenticated;
grant execute on function public.team_lineup_min_teams() to service_role;
grant execute on function public.fill_triple_support_aggregates(numeric) to service_role;
grant execute on function public.rebuild_triple_support_aggregates(numeric, boolean) to service_role;
grant execute on function public.read_team_lineup_shapes(smallint[]) to anon, service_role;

-- Fill the shapes now, so the first comparison with a direct count needs no waiting. Half-seasons
-- whose raw rows are already purged cannot be filled.
select public.recompute_triple_support_aggregates();
