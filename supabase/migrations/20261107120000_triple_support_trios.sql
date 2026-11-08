-- Issue 560: how often a team runs exactly three Strategists, which three, and how those teams fare,
-- per half-season, game mode and rank bucket, kept as anonymous counts that outlive the raw rows. No
-- uid, name, fingerprint or per-player row is stored here. Nothing is published by this migration.
--
-- A separate family, as `hero_pair_aggregates` is: it owns its rebuild and freeze and does not touch
-- the other families. `recompute_triple_support_aggregates` rebuilds every half-season that still has
-- raw rows and is not frozen, from scratch, so a late result or a `forget_player` shows up on the next
-- run and running it twice changes nothing. `purge_expired_participants` calls
-- `freeze_triple_support_aggregates` just before it deletes, which rebuilds each half-season that is
-- going one last time and marks it frozen. A frozen half-season is never rebuilt again.
--
-- Which heroes are Strategists. The rebuild runs inside the database (hourly, and in the purge), so
-- it cannot ask the website which game hero id has which role. `hero_game_roles` is that answer, one
-- row per game hero id, seeded below from data/pulse-atlas/hero-game-ids.json and the hero list. A new
-- hero needs a row in the same pull request that adds it to hero-game-ids.json (a spec compares the two).
-- The healer or utility tag is not needed here: it only names a trio, and the website does that when
-- it reads, from data/pulse-atlas/strategist-tags.json.
--
-- A team counts as a trio when it has exactly three Strategists and every one of its players' heroes
-- is known to `hero_game_roles`. Hero id 0 ("no hero recorded"), Deadpool's base id 1057 (the game
-- reports his role forms, 10571 to 10573) and any id not in the table are unknown, because they could
-- be a Strategist: the team is counted as unclassified, never as a trio and never silently dropped.
-- `hero_id` is the hero a player ended the match on. A team with four or more Strategists is counted as
-- that shape only (`four_plus_teams`); its heroes are not stored.
--
-- Rank. `rank_bucket` is -1 (unknown) on every row today, as in `hero_pair_aggregates`;
-- `fill_triple_support_aggregates` is the one place that will derive it (issue 337).
--
-- Recorder diversity. The totals table records, per half-season, mode and rank bucket, how many
-- distinct recorders contributed and how many matches the busiest one did (counts only, never who).
-- `read_triple_support_trios` returns a rank bucket of 0 or more only when `community_bucket_shown`
-- passes for that mode's own totals; unknown rank (-1) is returned without that gate, as the pair reader does.
--
-- Additive: no existing table is touched. `purge_expired_participants` is restated with the same
-- signature (a body change) and calls the new freeze after the other families' own.

-- The smallest number of decided matches a trio needs, over its half-season, to be stored and read.
create or replace function public.triple_support_min_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- The role of each game hero id. `base_game_id` is the hero's own id, which a hero the game splits by
-- role (Deadpool) shares between his forms. Deadpool's base id 1057 has no role and is left out.
create table if not exists public.hero_game_roles (
  game_id integer primary key,
  base_game_id integer not null,
  role text not null,
  constraint hero_game_roles_role_known check (role in ('Vanguard', 'Duelist', 'Strategist'))
);

alter table public.hero_game_roles enable row level security;
revoke all on public.hero_game_roles from anon, authenticated;
grant select, insert, update, delete on public.hero_game_roles to service_role;

-- Roles as the live hero list has them on 2026-11-07. The comment on each row is the hero's slug.
insert into public.hero_game_roles (game_id, base_game_id, role) values
  (1011, 1011, 'Vanguard'), -- hulk
  (1014, 1014, 'Duelist'), -- the-punisher
  (1015, 1015, 'Duelist'), -- storm
  (1016, 1016, 'Strategist'), -- loki
  (1017, 1017, 'Duelist'), -- human-torch
  (1018, 1018, 'Vanguard'), -- doctor-strange
  (1020, 1020, 'Strategist'), -- mantis
  (1021, 1021, 'Duelist'), -- hawkeye
  (1022, 1022, 'Vanguard'), -- captain-america
  (1023, 1023, 'Strategist'), -- rocket-raccoon
  (1024, 1024, 'Duelist'), -- hela
  (1025, 1025, 'Strategist'), -- cloak-and-dagger
  (1026, 1026, 'Duelist'), -- black-panther
  (1027, 1027, 'Vanguard'), -- groot
  (1028, 1028, 'Strategist'), -- ultron
  (1029, 1029, 'Duelist'), -- magik
  (1030, 1030, 'Duelist'), -- moon-knight
  (1031, 1031, 'Strategist'), -- luna-snow
  (1032, 1032, 'Duelist'), -- squirrel-girl
  (1033, 1033, 'Duelist'), -- black-widow
  (1034, 1034, 'Duelist'), -- iron-man
  (1035, 1035, 'Vanguard'), -- venom
  (1036, 1036, 'Duelist'), -- spider-man
  (1037, 1037, 'Vanguard'), -- magneto
  (1038, 1038, 'Duelist'), -- scarlet-witch
  (1039, 1039, 'Vanguard'), -- thor
  (1040, 1040, 'Duelist'), -- mister-fantastic
  (1041, 1041, 'Duelist'), -- winter-soldier
  (1042, 1042, 'Vanguard'), -- peni-parker
  (1043, 1043, 'Duelist'), -- star-lord
  (1044, 1044, 'Duelist'), -- blade
  (1045, 1045, 'Duelist'), -- namor
  (1046, 1046, 'Strategist'), -- adam-warlock
  (1047, 1047, 'Strategist'), -- jeff-the-land-shark
  (1048, 1048, 'Duelist'), -- psylocke
  (1049, 1049, 'Duelist'), -- wolverine
  (1050, 1050, 'Strategist'), -- invisible-woman
  (1051, 1051, 'Vanguard'), -- the-thing
  (1052, 1052, 'Duelist'), -- iron-fist
  (1053, 1053, 'Vanguard'), -- emma-frost
  (1054, 1054, 'Duelist'), -- phoenix
  (1055, 1055, 'Duelist'), -- daredevil
  (1056, 1056, 'Vanguard'), -- angela
  (1058, 1058, 'Strategist'), -- gambit
  (1059, 1059, 'Duelist'), -- elsa-bloodstone
  (1060, 1060, 'Strategist'), -- white-fox
  (1061, 1061, 'Duelist'), -- black-cat
  (1062, 1062, 'Vanguard'), -- devil-dinosaur
  (1063, 1063, 'Duelist'), -- cyclops
  (1064, 1064, 'Strategist'), -- jubilee
  (1065, 1065, 'Vanguard'), -- rogue
  (1066, 1066, 'Vanguard'), -- the-hood
  (1067, 1067, 'Duelist'), -- gorr-the-god-butcher
  (10571, 1057, 'Vanguard'), -- deadpool
  (10572, 1057, 'Duelist'), -- deadpool
  (10573, 1057, 'Strategist') -- deadpool
on conflict (game_id) do update set base_game_id = excluded.base_game_id, role = excluded.role;

-- One row per half-season that has been aggregated here.
create table if not exists public.triple_support_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set by the purge when it freezes the half-season. Null while the half-season is still rebuilt.
  frozen_at timestamptz
);

-- Per half-season, game mode, rank bucket and trio. play_mode_id is the match's mode (0 Quick Match,
-- 1 Competitive, 2 Arcade, 3 Practice) or -1 when the game did not say; rank_bucket is -1 when the
-- rank is unknown (a key cannot hold a null). hero_a < hero_b < hero_c are the three Strategists'
-- base game ids (Deadpool's role forms under 1057); a hero twice on a team repeats its id, so the
-- order is non-strict.
--
-- One occurrence is one team with exactly these three Strategists in a match with a result: a match
-- where both teams run the trio adds 2 teams and 1 match. wins is the occurrences that won.
--
-- A trio is stored (in every mode and bucket it was seen in) only when its matches, summed over all
-- modes and buckets of the half-season, reach `triple_support_min_matches()`.
create table if not exists public.triple_support_trios (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  rank_bucket smallint not null,
  hero_a integer not null,
  hero_b integer not null,
  hero_c integer not null,
  matches integer not null,
  teams integer not null,
  wins integer not null,
  primary key (half_season, play_mode_id, rank_bucket, hero_a, hero_b, hero_c),
  constraint triple_support_trios_rank_bucket_known check (rank_bucket >= -1),
  constraint triple_support_trios_heroes_sorted check (hero_a <= hero_b and hero_b <= hero_c),
  constraint triple_support_trios_counts_consistent check (wins <= teams and matches <= teams)
);

-- Per half-season, mode and rank bucket: the matches counted and who recorded them in numbers only
-- (the denominator and the input of the recorder gate), and the teams of those matches that had a
-- result, split by what could be said about them. classified_teams is every team whose heroes all have
-- a known role, whatever its number of Strategists: the denominator of a trio's share.
create table if not exists public.triple_support_totals (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  rank_bucket smallint not null,
  matches integer not null,
  decided_matches integer not null,
  -- Distinct recorders of these matches, and the matches of the one who recorded most of them.
  recorders integer not null,
  top_recorder_matches integer not null,
  classified_teams integer not null,
  -- Teams with a hero no role is known for: neither a trio nor a non-trio, and not in classified_teams.
  unclassified_teams integer not null,
  -- Classified teams with four or more Strategists, counted as that shape only.
  four_plus_teams integer not null,
  primary key (half_season, play_mode_id, rank_bucket),
  constraint triple_support_totals_rank_bucket_known check (rank_bucket >= -1),
  constraint triple_support_totals_counts_consistent check (
    decided_matches <= matches and recorders >= 1 and top_recorder_matches between 1 and matches
    and four_plus_teams <= classified_teams
  )
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key. The website
-- reads these counts through `read_triple_support_trios` only.
alter table public.triple_support_aggregate_half_seasons enable row level security;
alter table public.triple_support_trios enable row level security;
alter table public.triple_support_totals enable row level security;
revoke all on public.triple_support_aggregate_half_seasons from anon, authenticated;
revoke all on public.triple_support_trios from anon, authenticated;
revoke all on public.triple_support_totals from anon, authenticated;
grant select, insert, update, delete on public.triple_support_aggregate_half_seasons to service_role;
grant select, insert, update, delete on public.triple_support_trios to service_role;
grant select, insert, update, delete on public.triple_support_totals to service_role;

-- Writes both count tables for one half-season from a single read of its raw rows, in one statement,
-- so the trios and the totals always describe the same set of matches. The caller has emptied the
-- half-season's rows first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later). Mode
-- belongs to the match, so it is read once per match rather than trusted line by line, and so does
-- the recorder: the one whose upload stored its lines. A scoreboard line is one player in one match,
-- so two lines on a team are two different players.
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

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts the purge has already preserved).
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
  delete from public.triple_support_totals where half_season = p_half_season;

  perform public.fill_triple_support_aggregates(p_half_season);

  insert into public.triple_support_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen. Returns
-- how many it rebuilt. One transaction, so a reader never sees half a rebuild.
create or replace function public.recompute_triple_support_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct p.half_season from public.participants p order by 1 loop
    if public.rebuild_triple_support_aggregates(h) then
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
create or replace function public.freeze_triple_support_aggregates() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.rebuild_triple_support_aggregates(due.half_season, true)
  from (
    select p.half_season from public.participants p
    group by p.half_season
    having public.participants_past_retention(p.half_season, min(p.played_at))
  ) due;
end
$$;

-- Freezes every aggregate family before deleting; a later restatement must keep calling every freeze.
-- Returns the scoreboard rows deleted.
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

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;

  delete from public.match_hero_kills k
  where public.participants_past_retention(k.half_season, k.played_at);

  return removed;
end
$$;

-- Trios for a chosen set of modes, summed over those modes, one row per half-season, rank bucket and
-- trio, with the half-season's team counts for the same modes. It runs as its owner and reads only
-- the two aggregate tables.
--  * `triple_support_trios` keeps a trio only when its matches over every mode and bucket reach
--    `triple_support_min_matches()`, so a subset of modes can leave a trio below the minimum; the
--    minimum is applied again here to the row's own sum.
--  * A rank bucket of 0 or more is returned only from the (half-season, mode, bucket) rows whose own
--    totals pass `community_bucket_shown`, checked before anything is summed, for the trios and for
--    the team counts alike. Distinct recorders cannot be added across modes, and a gate on a combined
--    figure would let a caller subtract one list of modes from another and recover a hidden mode.
--    Recorder counts are not returned.
--  * Rank bucket -1 (unknown) is returned ungated.
-- classified_teams is the denominator of a trio's share of all classified teams.
-- The rows come back in a stable order so a caller can page through them (PostgREST cuts a page at
-- 1000 rows).
create or replace function public.read_triple_support_trios(
  p_play_mode_ids smallint[] default array[0, 1]::smallint[]
) returns table (
  half_season numeric,
  rank_bucket smallint,
  hero_a integer,
  hero_b integer,
  hero_c integer,
  matches integer,
  teams integer,
  wins integer,
  classified_teams integer,
  unclassified_teams integer,
  four_plus_teams integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with shown as (
    select t.half_season, t.play_mode_id, t.rank_bucket,
           t.classified_teams, t.unclassified_teams, t.four_plus_teams
    from public.triple_support_totals t
    where t.play_mode_id = any (p_play_mode_ids)
      and (t.rank_bucket < 0
           or public.community_bucket_shown(t.matches, t.recorders, t.top_recorder_matches))
  ),
  denominators as (
    select s.half_season, s.rank_bucket,
           sum(s.classified_teams) as classified_teams,
           sum(s.unclassified_teams) as unclassified_teams,
           sum(s.four_plus_teams) as four_plus_teams
    from shown s
    group by s.half_season, s.rank_bucket
  ),
  summed as (
    select x.half_season, x.rank_bucket, x.hero_a, x.hero_b, x.hero_c,
           sum(x.matches) as matches, sum(x.teams) as teams, sum(x.wins) as wins
    from public.triple_support_trios x
    join shown s
      on s.half_season = x.half_season and s.play_mode_id = x.play_mode_id and s.rank_bucket = x.rank_bucket
    group by x.half_season, x.rank_bucket, x.hero_a, x.hero_b, x.hero_c
    having sum(x.matches) >= public.triple_support_min_matches()
  )
  select u.half_season, u.rank_bucket, u.hero_a, u.hero_b, u.hero_c,
         u.matches::integer, u.teams::integer, u.wins::integer,
         d.classified_teams::integer, d.unclassified_teams::integer, d.four_plus_teams::integer
  from summed u
  join denominators d on d.half_season = u.half_season and d.rank_bucket = u.rank_bucket
  order by u.half_season, u.rank_bucket, u.hero_a, u.hero_b, u.hero_c
$$;

-- Checked when the migration runs, so a wrong constant or a missing role fails the push.
do $$
begin
  assert public.triple_support_min_matches() > 0, 'a trio must need at least one match';
  assert (select count(*) from public.hero_game_roles where role = 'Strategist') >= 12,
    'the Strategists must be seeded';
  assert not exists (select 1 from public.hero_game_roles where game_id = 1057 or game_id = 0),
    'Deadpool''s base id and hero id 0 have no role';
end
$$;

-- The gate is the privacy rule, so it is exercised on fixtures in a half-season that does not exist:
-- a bucket of one recorder (mode 0) and a bucket of three (mode 1), each with one 10-match trio. Only
-- the second may come back, alone and in a list of both modes, and its team counts must not include
-- the first. The fixtures are rolled back by the sentinel exception (P0042). If the fixtures cannot
-- be written, the check is skipped with a warning; an error from the reader itself, or a failed
-- assertion, fails the push.
do $$
declare
  written boolean := false;
  one_recorder_returned boolean;
  three_recorders_matches integer;
  both_modes_matches integer;
  both_modes_classified integer;
begin
  begin
    begin
      insert into public.triple_support_trios
        (half_season, play_mode_id, rank_bucket, hero_a, hero_b, hero_c, matches, teams, wins)
      values (99.0, 0, 0, 1, 2, 3, 10, 10, 5), (99.0, 1, 0, 1, 2, 3, 10, 10, 5);
      insert into public.triple_support_totals
        (half_season, play_mode_id, rank_bucket, matches, decided_matches, recorders, top_recorder_matches,
         classified_teams, unclassified_teams, four_plus_teams)
      values (99.0, 0, 0, 10, 10, 1, 10, 20, 0, 0), (99.0, 1, 0, 10, 10, 3, 5, 20, 2, 1);
      written := true;
    exception when others then
      raise warning 'triple support gate check skipped (%)', sqlerrm;
    end;

    if written then
      select exists (select 1 from public.read_triple_support_trios(array[0]::smallint[]) r where r.half_season = 99.0)
        into one_recorder_returned;
      select coalesce(sum(r.matches), 0) into three_recorders_matches
        from public.read_triple_support_trios(array[1]::smallint[]) r
        where r.half_season = 99.0;
      select coalesce(sum(r.matches), 0), coalesce(max(r.classified_teams), 0)
        into both_modes_matches, both_modes_classified
        from public.read_triple_support_trios(array[0, 1]::smallint[]) r
        where r.half_season = 99.0;

      raise exception 'roll back the gate fixtures' using errcode = 'P0042';
    end if;
  exception when sqlstate 'P0042' then
    null;
  end;

  if written then
    assert not one_recorder_returned, 'a one-recorder rank bucket must be hidden';
    assert three_recorders_matches = 10, 'a bucket that passes must be returned';
    assert both_modes_matches = 10, 'only the bucket that passes may be returned, whatever modes are asked for';
    assert both_modes_classified = 20, 'team counts must come only from the buckets that pass';
  end if;
end
$$;

-- Postgres grants EXECUTE to everyone on a new function. The reader is for the publishable key (the
-- `anon` role) and the service role, as `read_hero_pairs` is; everything else is for the service
-- role and the scheduler only.
revoke execute on function public.triple_support_min_matches() from public, anon, authenticated;
revoke execute on function public.fill_triple_support_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_triple_support_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_triple_support_aggregates() from public, anon, authenticated;
revoke execute on function public.freeze_triple_support_aggregates() from public, anon, authenticated;
revoke execute on function public.purge_expired_participants() from public, anon, authenticated;
revoke execute on function public.read_triple_support_trios(smallint[]) from public, anon, authenticated;
grant execute on function public.triple_support_min_matches() to service_role;
grant execute on function public.fill_triple_support_aggregates(numeric) to service_role;
grant execute on function public.rebuild_triple_support_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_triple_support_aggregates() to service_role;
grant execute on function public.freeze_triple_support_aggregates() to service_role;
grant execute on function public.purge_expired_participants() to service_role;
grant execute on function public.read_triple_support_trios(smallint[]) to anon, service_role;

-- Fill the tables now, so the first comparison with a direct count needs no waiting. Half-seasons
-- whose raw rows are already purged cannot be filled.
select public.recompute_triple_support_aggregates();

-- Rebuild hourly, at a different minute from the other families, where pg_cron is already installed.
-- The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-triple-support-aggregates';
    perform cron.schedule('recompute-triple-support-aggregates', '47 * * * *', 'select public.recompute_triple_support_aggregates()');
  else
    raise warning 'pg_cron is not installed: triple support aggregates are rebuilt only when the purge freezes a half-season';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): triple support aggregates are rebuilt only when the purge freezes a half-season', sqlerrm;
end
$$;
