-- Issue 651: how a hero fares while facing one specific enemy hero, not only how often it wins. The
-- head-to-head detail could show each hero's overall KDA and final hits but not these, because
-- `hero_matchups` stored matches, decided lines and wins only.
--
-- `hero_matchups` gains the sums and counts `hero_aggregates` keeps for the same scoreboard figures:
-- kills, deaths, assists and final hits, each a sum and the number of lines that recorded it. They
-- cover the decided lines of the encounter, one per enemy hero faced, so a figure's count never
-- exceeds `decided_lines`. Sums and counts are stored, never an average, so the website can add rows
-- across modes and across a hero's merged game ids before it divides.
--
-- The columns are nullable and have no default: a half-season the purge froze before this migration
-- cannot be rebuilt (its raw rows are gone), so its rows keep null figures, and the reader returns
-- them as null. A null is never read as 0. Counts only: no uid, name, fingerprint or per-player row
-- is stored.
--
-- `fill_hero_aggregates` is restated from 20261108170000 with only the matchups insert changed, and
-- `read_hero_matchups` from 20261030050000 with the figures added, both with their signature,
-- security and grants. `rebuild_hero_aggregates`, `recompute_hero_aggregates` and the freeze in
-- `purge_expired_participants` call the fill and are not touched. The hourly job refills a half-season
-- that is not frozen; this migration runs it once at the end.
--
-- Pushing this migration is a separate step from merging the pull request: the website reads the old
-- answer (no figures) until it is applied, and shows the encounter figures as not available.

alter table public.hero_matchups
  add column if not exists kills_sum integer,
  add column if not exists kills_n integer,
  add column if not exists deaths_sum integer,
  add column if not exists deaths_n integer,
  add column if not exists assists_sum integer,
  add column if not exists assists_n integer,
  add column if not exists final_hits_sum integer,
  add column if not exists final_hits_n integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.hero_matchups'::regclass and conname = 'hero_matchups_figure_counts_consistent'
  ) then
    alter table public.hero_matchups add constraint hero_matchups_figure_counts_consistent check (
      (kills_n is null or kills_n <= decided_lines)
      and (deaths_n is null or deaths_n <= decided_lines)
      and (assists_n is null or assists_n <= decided_lines)
      and (final_hits_n is null or final_hits_n <= decided_lines)
    );
  end if;
end
$$;

-- As in 20261108170000, with each matchup row also carrying the scoreboard figures of the decided
-- lines it counts. A line's figures are part of the `select distinct` below: they belong to the line,
-- so they are the same on each of its copies and collapse with it.
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
      (half_season, play_mode_id, hero_id, enemy_hero_id, matches, decided_matches, decided_lines, wins,
       kills_sum, kills_n, deaths_sum, deaths_n, assists_sum, assists_n, final_hits_sum, final_hits_n)
    select p_half_season, m.play_mode_id, m.hero_id, m.enemy_hero_id,
           m.matches, m.decided_matches, m.decided_lines, m.wins,
           m.kills_sum, m.kills_n, m.deaths_sum, m.deaths_n,
           m.assists_sum, m.assists_n, m.final_hits_sum, m.final_hits_n
    from (
      select e.play_mode_id, e.hero_id, e.enemy_hero_id,
             count(distinct e.match_no) as matches,
             count(distinct e.match_no) filter (where e.is_win is not null) as decided_matches,
             count(*) filter (where e.is_win is not null) as decided_lines,
             count(*) filter (where e.is_win) as wins,
             -- The figures cover the decided lines counted above, and a line that did not record one
             -- is left out of that figure's count.
             coalesce(sum(e.kills) filter (where e.is_win is not null), 0) as kills_sum,
             count(e.kills) filter (where e.is_win is not null) as kills_n,
             coalesce(sum(e.deaths) filter (where e.is_win is not null), 0) as deaths_sum,
             count(e.deaths) filter (where e.is_win is not null) as deaths_n,
             coalesce(sum(e.assists) filter (where e.is_win is not null), 0) as assists_sum,
             count(e.assists) filter (where e.is_win is not null) as assists_n,
             coalesce(sum(e.final_hits) filter (where e.is_win is not null), 0) as final_hits_sum,
             count(e.final_hits) filter (where e.is_win is not null) as final_hits_n,
             -- A match has one mode, so summing over modes counts each decided match once.
             sum(count(distinct e.match_no) filter (where e.is_win is not null))
               over (partition by e.hero_id, e.enemy_hero_id) as half_season_decided_matches
      from (
        -- Each line once per enemy hero it faced, however many players on the other team picked it.
        select distinct a.line_id, a.match_no, a.play_mode_id, a.hero_id, b.hero_id as enemy_hero_id, a.is_win,
               a.kills, a.deaths, a.assists, a.final_hits
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

-- As in 20261030050000, with the figures summed over the modes asked for. A sum over rows that are
-- all null stays null, so a matchup from a frozen half-season reads as not counted, never as 0.
create or replace function public.read_hero_matchups(
  p_play_mode_ids smallint[] default array[0, 1]::smallint[]
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'half_season', m.half_season,
           'hero_id', m.hero_id,
           'enemy_hero_id', m.enemy_hero_id,
           'decided_matches', m.decided_matches,
           'decided_lines', m.decided_lines,
           'wins', m.wins,
           'kills_sum', m.kills_sum, 'kills_n', m.kills_n,
           'deaths_sum', m.deaths_sum, 'deaths_n', m.deaths_n,
           'assists_sum', m.assists_sum, 'assists_n', m.assists_n,
           'final_hits_sum', m.final_hits_sum, 'final_hits_n', m.final_hits_n)
         order by m.half_season, m.hero_id, m.enemy_hero_id), '[]'::jsonb)
  from (
    select x.half_season, x.hero_id, x.enemy_hero_id,
           sum(x.decided_matches) as decided_matches,
           sum(x.decided_lines) as decided_lines,
           sum(x.wins) as wins,
           sum(x.kills_sum) as kills_sum, sum(x.kills_n) as kills_n,
           sum(x.deaths_sum) as deaths_sum, sum(x.deaths_n) as deaths_n,
           sum(x.assists_sum) as assists_sum, sum(x.assists_n) as assists_n,
           sum(x.final_hits_sum) as final_hits_sum, sum(x.final_hits_n) as final_hits_n
    from public.hero_matchups x
    where x.play_mode_id = any (p_play_mode_ids)
    group by x.half_season, x.hero_id, x.enemy_hero_id
    having sum(x.decided_matches) >= public.hero_matchup_min_matches()
  ) m
$$;

-- Checked when the migration runs, on fixtures in a half-season that does not exist. Ten matches, six
-- in Quick Match and four in Competitive, each with hero 1 on one team (kills 5, deaths 2, assists 3,
-- final hits 10, a win) and two players on the other both on hero 2 (kills 1, deaths 4, assists 0,
-- final hits 4). In the last match hero 1 recorded no final hits.
--   hero 1 against hero 2: 10 lines, each once although two players picked hero 2; final hits count 9
--   hero 2 against hero 1: 20 lines, one for each player
-- The fixtures are rolled back by the sentinel exception (P0042). If they cannot be written, the check
-- is skipped with a warning; an error from the fill, or a failed assertion, fails the push.
do $$
declare
  written boolean := false;
  one_against_two public.hero_matchups%rowtype;
  two_against_one public.hero_matchups%rowtype;
  reader_one_against_two jsonb;
  reader_frozen jsonb;
begin
  begin
    begin
      insert into public.participants
        (fingerprint, half_season, played_at, name, team, hero_id, kills, deaths, assists, final_hits,
         is_win, recorded_by, play_mode_id)
      select 'fixture-m' || i, 99.0, timestamptz '2099-01-01 00:00:00+00' + i * interval '1 hour',
             'fixture-' || t.player, t.team, t.hero, t.kills, t.deaths, t.assists,
             case when i = 10 and t.team = 1 then null else t.final_hits end,
             t.team = 1, 'fixture-recorder', case when i <= 6 then 0 else 1 end
      from generate_series(1, 10) i
      cross join (values
        ('1', 1::smallint, 1, 5, 2, 3, 10),
        ('2', 2::smallint, 2, 1, 4, 0, 4),
        ('3', 2::smallint, 2, 1, 4, 0, 4)
      ) as t(player, team, hero, kills, deaths, assists, final_hits);
      written := true;
    exception when others then
      raise warning 'hero matchup encounter figures check skipped (%)', sqlerrm;
    end;

    if written then
      perform public.fill_hero_aggregates(99.0);

      select * into one_against_two from public.hero_matchups
        where half_season = 99.0 and play_mode_id = 0 and hero_id = 1 and enemy_hero_id = 2;
      select * into two_against_one from public.hero_matchups
        where half_season = 99.0 and play_mode_id = 0 and hero_id = 2 and enemy_hero_id = 1;
      select e into reader_one_against_two
        from jsonb_array_elements(public.read_hero_matchups()) e
        where (e ->> 'half_season')::numeric = 99.0 and (e ->> 'hero_id')::integer = 1
          and (e ->> 'enemy_hero_id')::integer = 2;

      -- A frozen half-season has no figures; the reader must return them as null.
      update public.hero_matchups
        set kills_sum = null, kills_n = null, deaths_sum = null, deaths_n = null,
            assists_sum = null, assists_n = null, final_hits_sum = null, final_hits_n = null
        where half_season = 99.0;
      select e into reader_frozen
        from jsonb_array_elements(public.read_hero_matchups()) e
        where (e ->> 'half_season')::numeric = 99.0 and (e ->> 'hero_id')::integer = 1
          and (e ->> 'enemy_hero_id')::integer = 2;

      raise exception 'roll back the matchup figure fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert one_against_two.decided_lines = 6 and one_against_two.kills_sum = 30 and one_against_two.kills_n = 6,
      'a line facing a hero that two players picked must count once in Quick Match';
    assert one_against_two.deaths_sum = 12 and one_against_two.assists_sum = 18 and one_against_two.final_hits_sum = 60,
      'the other figures must be summed over the same lines';
    assert two_against_one.decided_lines = 12 and two_against_one.kills_sum = 12 and two_against_one.kills_n = 12,
      'each of the two players on hero 2 must count once against hero 1';
    assert two_against_one.deaths_sum = 48 and two_against_one.assists_sum = 0 and two_against_one.assists_n = 12,
      'a figure of 0 must be a recorded 0, not a missing one';
    assert (reader_one_against_two ->> 'kills_sum')::integer = 50 and (reader_one_against_two ->> 'kills_n')::integer = 10,
      'the reader must sum the figures over the modes asked for';
    assert (reader_one_against_two ->> 'final_hits_sum')::integer = 90 and (reader_one_against_two ->> 'final_hits_n')::integer = 9,
      'a line with no final hits must be left out of that count, not counted as 0';
    assert reader_frozen -> 'kills_sum' = 'null'::jsonb and reader_frozen -> 'final_hits_n' = 'null'::jsonb,
      'the reader must return missing figures as null, never as 0';
  end if;
end
$$;

-- The same signatures and grants as before: the reader for the publishable key and the service role,
-- the fill for the service role and the scheduler only.
revoke execute on function public.fill_hero_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.read_hero_matchups(smallint[]) from public, anon, authenticated;
grant execute on function public.fill_hero_aggregates(numeric) to service_role;
grant execute on function public.read_hero_matchups(smallint[]) to anon, service_role;

-- Fill the half-seasons that still have raw rows and are not frozen now, so the figures need no
-- waiting for the hourly job. A frozen half-season keeps null figures.
select public.recompute_hero_aggregates();
