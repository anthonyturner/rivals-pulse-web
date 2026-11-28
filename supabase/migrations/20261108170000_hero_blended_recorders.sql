-- Issue 644: how many different players back each hero across the blended modes (Quick Match and
-- Competitive), the view the hero stats and the tier list open on. `hero_aggregates.recorders` is per
-- mode, and the same player records in both modes, so the website could only take the larger of the
-- two: a hero one player recorded in Quick Match and another in Competitive read as 1 player and was
-- held back by the two-player gate (issue 640) although two people recorded it.
--
-- `hero_aggregates.blended_recorders` is the number of distinct recorders (the user whose upload stored
-- a match, as in `recorders`) of the Quick Match and Competitive matches this hero appeared in, each
-- person once whichever of the two they played. The same figure sits on the hero's Quick Match row and
-- on its Competitive row, so a row is read the same way whichever of them the website holds. It is null
-- on a row of any other mode, and where nobody counted it: a half-season the purge froze before this
-- migration cannot be backfilled, because its raw rows are gone, and a null is never read as 0 or 1.
-- Counts only: no uid, name, fingerprint or per-player row is stored.
--
-- `fill_hero_aggregates` is restated from 20261108160000 with the same signature, and `read_hero_stats`
-- with the same signature, security and grants. `rebuild_hero_aggregates`, `recompute_hero_aggregates`
-- and the freeze in `purge_expired_participants` call the fill and are not touched, so the rebuild and
-- the freeze fill the column with it. The hourly job fills a half-season that is not frozen; this
-- migration runs it once at the end.
--
-- Pushing this migration is a separate step from merging the pull request: the Supabase integration
-- applies it after the merge.

alter table public.hero_aggregates add column if not exists blended_recorders integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hero_aggregates'::regclass and conname = 'hero_aggregates_blended_recorders_consistent'
  ) then
    alter table public.hero_aggregates add constraint hero_aggregates_blended_recorders_consistent
      check (blended_recorders is null or (blended_recorders >= 1 and blended_recorders >= coalesce(recorders, 1)));
  end if;
end
$$;

-- As in 20261108160000, with each Quick Match and Competitive hero row also carrying the hero's
-- distinct recorders over both modes. Modes 0 and 1 are the blend, as in `play_time_mode_ids()`.
create or replace function public.fill_hero_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with l as materialized (
    -- A match is its roster fingerprint plus its start time (the same roster can play again later).
    -- Mode and recorder belong to the match, so each is read once per match rather than trusted line
    -- by line.
    select p.id as line_id,
           dense_rank() over (order by p.fingerprint, p.played_at) as match_no,
           coalesce(min(p.play_mode_id) over (partition by p.fingerprint, p.played_at), -1)::smallint as play_mode_id,
           min(p.recorded_by) over (partition by p.fingerprint, p.played_at) as recorder,
           p.team, p.hero_id, p.kills, p.deaths, p.assists, p.final_hits, p.is_win
    from public.participants p
    where p.half_season = p_half_season
  ),
  blended as (
    -- A distinct count cannot be a window over the rows above, and cannot be added across modes.
    select l.hero_id, count(distinct l.recorder)::integer as recorders
    from l
    where l.hero_id is not null and l.play_mode_id in (0, 1)
    group by l.hero_id
  ),
  heroes as (
    insert into public.hero_aggregates
      (half_season, play_mode_id, hero_id, lines, decided_lines, wins, matches, decided_matches,
       kills_sum, kills_n, deaths_sum, deaths_n, assists_sum, assists_n, final_hits_sum, final_hits_n,
       recorders, blended_recorders)
    select p_half_season, l.play_mode_id, l.hero_id,
           count(*),
           count(l.is_win),
           count(*) filter (where l.is_win),
           count(distinct l.match_no),
           count(distinct l.match_no) filter (where l.is_win is not null),
           coalesce(sum(l.kills), 0), count(l.kills),
           coalesce(sum(l.deaths), 0), count(l.deaths),
           coalesce(sum(l.assists), 0), count(l.assists),
           coalesce(sum(l.final_hits), 0), count(l.final_hits),
           count(distinct l.recorder)::integer,
           max(b.recorders)
    from l
    left join blended b on b.hero_id = l.hero_id and l.play_mode_id in (0, 1)
    where l.hero_id is not null
    group by l.play_mode_id, l.hero_id
    returning 1
  ),
  totals as (
    insert into public.hero_aggregate_totals (half_season, play_mode_id, matches, decided_matches)
    select p_half_season, l.play_mode_id,
           count(distinct l.match_no),
           count(distinct l.match_no) filter (where l.is_win is not null)
    from l
    group by l.play_mode_id
    returning 1
  ),
  matchups as (
    insert into public.hero_matchups
      (half_season, play_mode_id, hero_id, enemy_hero_id, matches, decided_matches, decided_lines, wins)
    select p_half_season, m.play_mode_id, m.hero_id, m.enemy_hero_id,
           m.matches, m.decided_matches, m.decided_lines, m.wins
    from (
      select e.play_mode_id, e.hero_id, e.enemy_hero_id,
             count(distinct e.match_no) as matches,
             count(distinct e.match_no) filter (where e.is_win is not null) as decided_matches,
             count(*) filter (where e.is_win is not null) as decided_lines,
             count(*) filter (where e.is_win) as wins,
             -- A match has one mode, so summing over modes counts each decided match once.
             sum(count(distinct e.match_no) filter (where e.is_win is not null))
               over (partition by e.hero_id, e.enemy_hero_id) as half_season_decided_matches
      from (
        -- Each line once per enemy hero it faced, however many players on the other team picked it.
        select distinct a.line_id, a.match_no, a.play_mode_id, a.hero_id, b.hero_id as enemy_hero_id, a.is_win
        from l a
        join l b on b.match_no = a.match_no and b.team <> a.team
        where a.hero_id is not null and b.hero_id is not null
      ) e
      group by e.play_mode_id, e.hero_id, e.enemy_hero_id
    ) m
    where m.half_season_decided_matches >= public.hero_matchup_min_matches()
    returning 1
  )
  select 1
$$;

-- As in 20261108160000, with each hero row's blended recorder count (null when it was never counted
-- or the row is not Quick Match or Competitive).
create or replace function public.read_hero_stats() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'half_seasons', coalesce((
      select jsonb_agg(jsonb_build_object('half_season', h.half_season, 'starts_at', h.starts_at)
                       order by h.half_season)
      from public.half_seasons h
    ), '[]'::jsonb),
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', t.half_season,
               'play_mode_id', t.play_mode_id,
               'decided_matches', t.decided_matches)
             order by t.half_season, t.play_mode_id)
      from public.hero_aggregate_totals t
    ), '[]'::jsonb),
    'heroes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'hero_id', a.hero_id,
               'decided_lines', a.decided_lines,
               'wins', a.wins,
               'kills_sum', a.kills_sum, 'kills_n', a.kills_n,
               'deaths_sum', a.deaths_sum, 'deaths_n', a.deaths_n,
               'assists_sum', a.assists_sum, 'assists_n', a.assists_n,
               'final_hits_sum', a.final_hits_sum, 'final_hits_n', a.final_hits_n,
               'recorders', a.recorders,
               'blended_recorders', a.blended_recorders)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_aggregates a
    ), '[]'::jsonb)
  )
$$;

-- Checked when the migration runs, on fixtures in a half-season that does not exist (recorders R1, R2):
--   a  Quick Match, R1: hero 1 against hero 2      c  Competitive, R1: hero 2 against hero 5
--   b  Competitive, R2: hero 1 against hero 5      d  Arcade, R1: hero 3 against hero 4
--   e  Quick Match, R2: hero 4 against hero 5
-- Hero 1 is R1 in one mode and R2 in the other: 2 recorders in the blend, 1 in each mode. Hero 2 is R1
-- in both modes: 1 in the blend. Hero 5 has R2 and R1 across the modes. Hero 4 has R2 in the blend and
-- R1 in Arcade, which is not part of it. Hero 3 is in Arcade only. The fixtures are rolled back by the
-- sentinel exception (P0042). If the fixtures cannot be written, the check is skipped with a warning;
-- an error from the fill, or a failed assertion, fails the push.
do $$
declare
  written boolean := false;
  hero_one_quick integer;
  hero_one_competitive integer;
  hero_one_quick_own integer;
  hero_one_competitive_own integer;
  hero_two_quick integer;
  hero_two_competitive integer;
  hero_five_quick integer;
  hero_five_competitive integer;
  hero_four_quick integer;
  hero_four_arcade integer;
  hero_three_arcade integer;
  hero_three_rows integer;
  reader_hero_one integer;
  reader_hero_three jsonb;
begin
  begin
    begin
      insert into public.participants
        (fingerprint, half_season, played_at, name, team, hero_id, is_win, recorded_by, play_mode_id)
      values
        ('fixture-a', 99.0, '2099-01-01T10:00:00Z', 'fixture-1', 1, 1, true, 'fixture-recorder-1', 0),
        ('fixture-a', 99.0, '2099-01-01T10:00:00Z', 'fixture-2', 2, 2, false, 'fixture-recorder-1', 0),
        ('fixture-b', 99.0, '2099-01-01T11:00:00Z', 'fixture-1', 1, 1, true, 'fixture-recorder-2', 1),
        ('fixture-b', 99.0, '2099-01-01T11:00:00Z', 'fixture-2', 2, 5, false, 'fixture-recorder-2', 1),
        ('fixture-c', 99.0, '2099-01-01T12:00:00Z', 'fixture-1', 1, 2, true, 'fixture-recorder-1', 1),
        ('fixture-c', 99.0, '2099-01-01T12:00:00Z', 'fixture-2', 2, 5, false, 'fixture-recorder-1', 1),
        ('fixture-d', 99.0, '2099-01-01T13:00:00Z', 'fixture-1', 1, 3, true, 'fixture-recorder-1', 2),
        ('fixture-d', 99.0, '2099-01-01T13:00:00Z', 'fixture-2', 2, 4, false, 'fixture-recorder-1', 2),
        ('fixture-e', 99.0, '2099-01-01T14:00:00Z', 'fixture-1', 1, 4, true, 'fixture-recorder-2', 0),
        ('fixture-e', 99.0, '2099-01-01T14:00:00Z', 'fixture-2', 2, 5, false, 'fixture-recorder-2', 0);
      written := true;
    exception when others then
      raise warning 'hero blended recorder count check skipped (%)', sqlerrm;
    end;

    if written then
      perform public.fill_hero_aggregates(99.0);

      select a.blended_recorders, a.recorders into hero_one_quick, hero_one_quick_own
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 1;
      select a.blended_recorders, a.recorders into hero_one_competitive, hero_one_competitive_own
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 1 and a.hero_id = 1;
      select a.blended_recorders into hero_two_quick
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 2;
      select a.blended_recorders into hero_two_competitive
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 1 and a.hero_id = 2;
      select a.blended_recorders into hero_five_quick
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 5;
      select a.blended_recorders into hero_five_competitive
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 1 and a.hero_id = 5;
      select a.blended_recorders into hero_four_quick
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 4;
      select a.blended_recorders into hero_four_arcade
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 2 and a.hero_id = 4;
      select a.blended_recorders into hero_three_arcade
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 2 and a.hero_id = 3;
      select count(*) into hero_three_rows
        from public.hero_aggregates a where a.half_season = 99.0 and a.hero_id = 3;
      select (e ->> 'blended_recorders')::integer into reader_hero_one
        from jsonb_array_elements(public.read_hero_stats() -> 'heroes') e
        where (e ->> 'half_season')::numeric = 99.0
          and (e ->> 'play_mode_id')::integer = 1
          and (e ->> 'hero_id')::integer = 1;
      select e into reader_hero_three
        from jsonb_array_elements(public.read_hero_stats() -> 'heroes') e
        where (e ->> 'half_season')::numeric = 99.0 and (e ->> 'hero_id')::integer = 3;

      raise exception 'roll back the blended recorder fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert hero_one_quick = 2 and hero_one_competitive = 2,
      'a recorder in Quick Match plus a different one in Competitive must count as two in the blend';
    assert hero_one_quick_own = 1 and hero_one_competitive_own = 1,
      'the per-mode counts must stay per mode';
    assert hero_two_quick = 1 and hero_two_competitive = 1,
      'the same recorder in both modes must count once in the blend';
    assert hero_five_quick = 2 and hero_five_competitive = 2,
      'a hero in both blended modes must carry the same blended count on each row';
    assert hero_four_quick = 1, 'a recorder in Arcade must not count in the blend';
    assert hero_four_arcade is null, 'a mode outside the blend must carry no blended count';
    assert hero_three_rows = 1 and hero_three_arcade is null,
      'a hero seen only outside the blend must carry no blended count';
    assert reader_hero_one = 2, 'the reader must return the stored blended count';
    assert reader_hero_three -> 'blended_recorders' = 'null'::jsonb,
      'the reader must return a missing blended count as null, never as 0';
  end if;
end
$$;

-- The same signatures and grants as before: the reader for the publishable key and the service role,
-- the fill for the service role and the scheduler only.
revoke execute on function public.fill_hero_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.read_hero_stats() from public, anon, authenticated;
grant execute on function public.fill_hero_aggregates(numeric) to service_role;
grant execute on function public.read_hero_stats() to anon, service_role;

-- Count the half-seasons that still have raw rows and are not frozen now, so the counts need no
-- waiting for the hourly job. A frozen half-season keeps a null count.
select public.recompute_hero_aggregates();
