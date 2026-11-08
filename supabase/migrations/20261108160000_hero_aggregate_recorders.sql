-- Issue 628: how many different players back each hero's counts, so the Pulse Atlas can draw
-- "1 of 2 players" beside "6 of 10 matches". Counts only: no uid, name, fingerprint or per-player row
-- is stored, and nothing is gated by it. Hero stats and the tier list stay gated by matches alone.
--
-- `hero_aggregates.recorders` is the number of distinct recorders (the user whose upload stored a
-- match, as in `hero_pair_totals`) of the matches this hero appeared in, per half-season and game mode.
-- It is null where nobody counted it: a half-season the purge froze before this migration cannot be
-- backfilled, because its raw rows are gone, and a null is never read as 0 or as 1.
--
-- Distinct recorders cannot be added across modes (the same player records in both), so the reader
-- hands the website one count per mode row and the website never sums them.
--
-- `fill_hero_aggregates` is restated with the same signature, and `read_hero_stats` with the same
-- signature and grants. `rebuild_hero_aggregates`, `recompute_hero_aggregates` and the freeze in
-- `purge_expired_participants` call the fill and are not touched, so the rebuild and the freeze fill
-- the column with it. The hourly job fills a half-season that is not frozen; this migration runs it
-- once at the end.
--
-- Pushing this migration is a separate step from merging the pull request: the Supabase integration
-- applies it after the merge.

alter table public.hero_aggregates add column if not exists recorders integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hero_aggregates'::regclass and conname = 'hero_aggregates_recorders_consistent'
  ) then
    alter table public.hero_aggregates add constraint hero_aggregates_recorders_consistent
      check (recorders is null or (recorders >= 1 and recorders <= matches));
  end if;
end
$$;

-- As in 20261030000000, with the recorder of each match read once per match and counted per hero.
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
  heroes as (
    insert into public.hero_aggregates
      (half_season, play_mode_id, hero_id, lines, decided_lines, wins, matches, decided_matches,
       kills_sum, kills_n, deaths_sum, deaths_n, assists_sum, assists_n, final_hits_sum, final_hits_n,
       recorders)
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
           count(distinct l.recorder)::integer
    from l
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

-- As in 20261030050000, with each hero row's recorder count (null when it was never counted).
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
               'recorders', a.recorders)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_aggregates a
    ), '[]'::jsonb)
  )
$$;

-- Checked when the migration runs, on fixtures in a half-season that does not exist: three matches in
-- mode 0 (two recorders; hero 1 in all three, hero 2 in one) and one match in mode 1 (hero 1, recorded
-- by the first). A recorder counts once per hero and mode however many matches they recorded, and a
-- recorder in another mode is not carried over. The fixtures are rolled back by the sentinel exception
-- (P0042). If the fixtures cannot be written, the check is skipped with a warning; an error from the
-- fill, or a failed assertion, fails the push.
do $$
declare
  written boolean := false;
  hero_one_mode_zero integer;
  hero_two_mode_zero integer;
  hero_one_mode_one integer;
  hero_one_matches integer;
  reader_recorders integer;
begin
  begin
    begin
      insert into public.participants
        (fingerprint, half_season, played_at, name, team, hero_id, is_win, recorded_by, play_mode_id)
      values
        ('fixture-a', 99.0, '2099-01-01T10:00:00Z', 'fixture-1', 1, 1, true, 'fixture-recorder-1', 0),
        ('fixture-a', 99.0, '2099-01-01T10:00:00Z', 'fixture-2', 2, 3, false, 'fixture-recorder-1', 0),
        ('fixture-b', 99.0, '2099-01-01T11:00:00Z', 'fixture-1', 1, 1, true, 'fixture-recorder-2', 0),
        ('fixture-b', 99.0, '2099-01-01T11:00:00Z', 'fixture-2', 2, 3, false, 'fixture-recorder-2', 0),
        ('fixture-c', 99.0, '2099-01-01T12:00:00Z', 'fixture-1', 1, 1, false, 'fixture-recorder-1', 0),
        ('fixture-c', 99.0, '2099-01-01T12:00:00Z', 'fixture-2', 2, 2, true, 'fixture-recorder-1', 0),
        ('fixture-d', 99.0, '2099-01-01T13:00:00Z', 'fixture-1', 1, 1, true, 'fixture-recorder-1', 1),
        ('fixture-d', 99.0, '2099-01-01T13:00:00Z', 'fixture-2', 2, 3, false, 'fixture-recorder-1', 1);
      written := true;
    exception when others then
      raise warning 'hero recorder count check skipped (%)', sqlerrm;
    end;

    if written then
      perform public.fill_hero_aggregates(99.0);

      select a.recorders into hero_one_mode_zero
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 1;
      select a.recorders into hero_two_mode_zero
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 0 and a.hero_id = 2;
      select a.recorders, a.matches into hero_one_mode_one, hero_one_matches
        from public.hero_aggregates a where a.half_season = 99.0 and a.play_mode_id = 1 and a.hero_id = 1;
      select (e ->> 'recorders')::integer into reader_recorders
        from jsonb_array_elements(public.read_hero_stats() -> 'heroes') e
        where (e ->> 'half_season')::numeric = 99.0
          and (e ->> 'play_mode_id')::integer = 0
          and (e ->> 'hero_id')::integer = 1;

      raise exception 'roll back the recorder fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert hero_one_mode_zero = 2, 'two recorders over three matches must count as two';
    assert hero_two_mode_zero = 1, 'a hero one recorder saw must count as one';
    assert hero_one_mode_one = 1 and hero_one_matches = 1, 'a recorder in another mode must not carry over';
    assert reader_recorders = 2, 'the reader must return the stored count';
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
