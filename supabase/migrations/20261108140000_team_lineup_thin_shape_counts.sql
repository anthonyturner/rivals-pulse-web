-- Issue 616: the reader of team line-up shapes returns a shape's team count while it is under
-- `team_lineup_min_teams()`, so the Pulse Atlas can draw "N of 50 teams" for it. The count is the only
-- thing released: a shape under the minimum still comes back with `enough_data` false and null wins, so
-- no win rate can be worked out from a handful of teams.
--
-- Only `read_team_lineup_shapes` is restated, with the same signature, grants and gate as in
-- 20261107140000. Which rank buckets are shown is unchanged, so a bucket the recorder gate hides still
-- returns nothing, thin shapes included. Nothing is rebuilt: the counts are already stored.
--
-- Pushing this migration is a separate step from merging the pull request: run `supabase db push`
-- after the merge.

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
         u.teams::integer,
         case when u.teams >= public.team_lineup_min_teams() then u.wins::integer end,
         coalesce(u.teams >= public.team_lineup_min_teams(), false),
         d.classified_teams::integer, d.unclassified_teams::integer
  from denominators d
  left join summed u on u.half_season = d.half_season and u.rank_bucket = d.rank_bucket
  order by d.half_season, d.rank_bucket, u.vanguards, u.duelists, u.strategists
$$;

-- The gate and the minimum on fixtures in a half-season that does not exist, as in 20261107140000: a
-- bucket of one recorder (mode 0) and a bucket of three (mode 1). In the second, one shape has 50 teams
-- over the minimum, one has 1 under it. The thin shape must come back with its team count and no wins,
-- the one-recorder bucket must still not come back, and the team counts must not include it. The
-- fixtures are rolled back by the sentinel exception (P0042). If the fixtures cannot be written, the
-- check is skipped with a warning; an error from the reader itself, or a failed assertion, fails the
-- push.
do $$
declare
  written boolean := false;
  one_recorder_returned boolean;
  rows_returned integer;
  enough_teams integer;
  enough_wins integer;
  thin_enough boolean;
  thin_teams integer;
  thin_wins integer;
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
      raise warning 'team lineup thin shape check skipped (%)', sqlerrm;
    end;

    if written then
      select exists (select 1 from public.read_team_lineup_shapes(array[0]::smallint[]) r where r.half_season = 99.0)
        into one_recorder_returned;
      select count(*), max(r.teams) filter (where r.enough_data), max(r.wins) filter (where r.enough_data),
             bool_or(r.enough_data) filter (where r.strategists = 3),
             max(r.teams) filter (where r.strategists = 3), max(r.wins) filter (where r.strategists = 3)
        into rows_returned, enough_teams, enough_wins, thin_enough, thin_teams, thin_wins
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
    assert thin_enough = false, 'a shape under the minimum must still say there is not enough data';
    assert thin_teams = min_teams - 1, 'a shape under the minimum must come back with its team count';
    assert thin_wins is null, 'a shape under the minimum must come back without wins';
    assert both_modes_classified = 2 * min_teams + 49, 'team counts must come only from the buckets that pass';
  end if;
end
$$;

revoke execute on function public.read_team_lineup_shapes(smallint[]) from public, anon, authenticated;
grant execute on function public.read_team_lineup_shapes(smallint[]) to anon, service_role;
