-- Issue 340: how often two heroes meet (on opposite teams) or play together (on the same team), per
-- half-season, game mode and rank bucket, kept as anonymous counts that outlive the raw rows. No uid,
-- name, fingerprint or per-player row is stored here. Nothing is published by this migration.
--
-- A separate family, as the extended aggregates are: it owns its rebuild and freeze and
-- does not touch `fill_hero_aggregates`. `recompute_hero_pair_aggregates` rebuilds every half-season
-- that still has raw rows and is not frozen, from scratch, so a late result or a `forget_player`
-- shows up on the next run and running it twice changes nothing. `purge_expired_participants` calls
-- `freeze_hero_pair_aggregates` just before it deletes, which rebuilds each half-season that is going
-- one last time and marks it frozen. A frozen half-season is never rebuilt again.
--
-- Rank. `rank_bucket` is -1 (unknown) on every row today, because no rank is stored with an upload.
-- The column is the place for 100-point buckets of the recorder's rank score once one is stored
-- (issue 337); `fill_hero_pair_aggregates` is the one place that will derive it.
--
-- Recorder diversity. The totals table records, per half-season, mode and rank bucket, how many
-- distinct recorders contributed and how many matches the busiest one did (counts only, never who).
-- `read_hero_pairs` returns a rank bucket of 0 or more only when `community_bucket_shown` passes for
-- that mode's own totals. Unknown rank (-1) is returned without that gate, as `hero_matchups` is read
-- today: with one uploader the gate would publish nothing.
--
-- `read_hero_matchups` already publishes ungated all-ranks 'vs' counts. Once buckets of 0 or more
-- exist, 'vs' rank buckets cannot be published while that reader stays ungated, because a bucket
-- could be recovered by subtracting the rest from its all-ranks total.
--
-- Additive: no existing table is touched. `purge_expired_participants` is restated with the same
-- signature (a body change) and calls the new freeze after the other families' own.

-- The smallest number of decided matches a pair needs, over its half-season, to be stored and read.
create or replace function public.hero_pair_min_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- One row per half-season that has been aggregated here.
create table if not exists public.hero_pair_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set by the purge when it freezes the half-season. Null while the half-season is still rebuilt.
  frozen_at timestamptz
);

-- Per half-season, game mode, rank bucket and pair of heroes. play_mode_id is the match's mode
-- (0 Quick Match, 1 Competitive, 2 Arcade, 3 Practice) or -1 when the game did not say; rank_bucket is
-- -1 when the rank is unknown (a key cannot hold a null).
--
-- 'vs' is directional, counted as `hero_matchups` counts it: hero_id on one team, other_hero_id on the
-- other, results from hero_id's side. One encounter is one hero_id line facing one hero on the other
-- team, so a hero fighting itself adds 2 decided lines and 1 match.
--
-- 'with' is stored once per unordered pair (hero_id < other_hero_id) and counted once per team
-- occurrence: a team in a match where two different players played the two heroes. A match where both
-- teams field the pair adds 2 occurrences and 1 match. The same hero twice on a team is not a pair.
-- decided_lines is the decided occurrences and wins the won ones.
--
-- A pair is stored (in every mode and bucket it was seen in) only when its decided matches, summed
-- over all modes and buckets of the half-season, reach `hero_pair_min_matches()`.
create table if not exists public.hero_pair_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  rank_bucket smallint not null,
  kind text not null,
  hero_id integer not null,
  other_hero_id integer not null,
  matches integer not null,
  decided_matches integer not null,
  decided_lines integer not null,
  wins integer not null,
  primary key (half_season, play_mode_id, rank_bucket, kind, hero_id, other_hero_id),
  constraint hero_pair_aggregates_kind_known check (kind in ('vs', 'with')),
  constraint hero_pair_aggregates_rank_bucket_known check (rank_bucket >= -1),
  constraint hero_pair_aggregates_with_is_ordered check (kind <> 'with' or hero_id < other_hero_id),
  constraint hero_pair_aggregates_counts_consistent check (
    wins <= decided_lines and decided_matches <= matches and decided_matches <= decided_lines
  )
);

-- Per half-season, mode and rank bucket: how many distinct matches were counted, and who recorded
-- them in numbers only. This is the denominator for a pair's share and the input of the recorder gate.
create table if not exists public.hero_pair_totals (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  rank_bucket smallint not null,
  matches integer not null,
  decided_matches integer not null,
  -- Distinct recorders of these matches, and the matches of the one who recorded most of them.
  recorders integer not null,
  top_recorder_matches integer not null,
  primary key (half_season, play_mode_id, rank_bucket),
  constraint hero_pair_totals_rank_bucket_known check (rank_bucket >= -1),
  constraint hero_pair_totals_counts_consistent check (
    decided_matches <= matches and recorders >= 1 and top_recorder_matches between 1 and matches
  )
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key. The website
-- reads these counts through `read_hero_pairs` only.
alter table public.hero_pair_aggregate_half_seasons enable row level security;
alter table public.hero_pair_aggregates enable row level security;
alter table public.hero_pair_totals enable row level security;
revoke all on public.hero_pair_aggregate_half_seasons from anon, authenticated;
revoke all on public.hero_pair_aggregates from anon, authenticated;
revoke all on public.hero_pair_totals from anon, authenticated;
grant select, insert, update, delete on public.hero_pair_aggregate_half_seasons to service_role;
grant select, insert, update, delete on public.hero_pair_aggregates to service_role;
grant select, insert, update, delete on public.hero_pair_totals to service_role;

-- Writes both count tables for one half-season from a single read of its raw rows, in one statement,
-- so the pairs and the totals always describe the same set of matches. The caller has emptied the
-- half-season's rows first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later). Mode
-- belongs to the match, so it is read once per match rather than trusted line by line, and so does
-- the recorder: the one whose upload stored its lines. A scoreboard line is one player in one match,
-- so two lines on a team are two different players.
create or replace function public.fill_hero_pair_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with l as materialized (
    select p.id as line_id,
           dense_rank() over (order by p.fingerprint, p.played_at) as match_no,
           coalesce(min(p.play_mode_id) over w, -1)::smallint as play_mode_id,
           -- No rank is stored with an upload yet; the recorder's rank bucket goes here.
           (-1)::smallint as rank_bucket,
           min(p.recorded_by) over w as recorder,
           p.team, p.hero_id, p.is_win
    from public.participants p
    where p.half_season = p_half_season
    window w as (partition by p.fingerprint, p.played_at)
  ),
  -- A team's result in a match: the result its lines agree on, null when none has one or they differ.
  teams as materialized (
    select l.match_no, l.team,
           case when bool_and(l.is_win) then true when not bool_or(l.is_win) then false end as is_win
    from l
    where l.team is not null
    group by l.match_no, l.team
  ),
  -- One row per encounter ('vs') or per team occurrence ('with'), each with its result.
  occurrences as (
    select 'vs'::text as kind, e.match_no, e.play_mode_id, e.rank_bucket, e.hero_id, e.other_hero_id, e.is_win
    from (
      -- Each line once per enemy hero it faced, however many players on the other team picked it.
      select distinct a.line_id, a.match_no, a.play_mode_id, a.rank_bucket, a.hero_id,
             b.hero_id as other_hero_id, a.is_win
      from l a
      join l b on b.match_no = a.match_no and b.team <> a.team
      where a.hero_id is not null and b.hero_id is not null
    ) e
    union all
    select 'with'::text, w.match_no, w.play_mode_id, w.rank_bucket, w.hero_id, w.other_hero_id, w.is_win
    from (
      -- Each team once per pair of different heroes it fielded, however many players picked each.
      select distinct a.match_no, a.team, a.play_mode_id, a.rank_bucket, a.hero_id,
             b.hero_id as other_hero_id, t.is_win
      from l a
      join l b on b.match_no = a.match_no and b.team = a.team and a.hero_id < b.hero_id
      join teams t on t.match_no = a.match_no and t.team = a.team
    ) w
  ),
  pairs as (
    insert into public.hero_pair_aggregates
      (half_season, play_mode_id, rank_bucket, kind, hero_id, other_hero_id,
       matches, decided_matches, decided_lines, wins)
    select p_half_season, m.play_mode_id, m.rank_bucket, m.kind, m.hero_id, m.other_hero_id,
           m.matches, m.decided_matches, m.decided_lines, m.wins
    from (
      select o.kind, o.play_mode_id, o.rank_bucket, o.hero_id, o.other_hero_id,
             count(distinct o.match_no) as matches,
             count(distinct o.match_no) filter (where o.is_win is not null) as decided_matches,
             count(*) filter (where o.is_win is not null) as decided_lines,
             count(*) filter (where o.is_win) as wins,
             -- A match has one mode and one rank bucket, so summing over them counts each decided
             -- match once.
             sum(count(distinct o.match_no) filter (where o.is_win is not null))
               over (partition by o.kind, o.hero_id, o.other_hero_id) as half_season_decided_matches
      from occurrences o
      group by o.kind, o.play_mode_id, o.rank_bucket, o.hero_id, o.other_hero_id
    ) m
    where m.half_season_decided_matches >= public.hero_pair_min_matches()
    returning 1
  ),
  totals as (
    insert into public.hero_pair_totals
      (half_season, play_mode_id, rank_bucket, matches, decided_matches, recorders, top_recorder_matches)
    select p_half_season, x.play_mode_id, x.rank_bucket,
           sum(x.matches)::integer, sum(x.decided_matches)::integer,
           count(*)::integer, max(x.matches)::integer
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
    returning 1
  )
  select 1
$$;

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts the purge has already preserved).
create or replace function public.rebuild_hero_pair_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('hero_pair_aggregates', 0));

  if exists (
    select 1 from public.hero_pair_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.participants where half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.hero_pair_aggregates where half_season = p_half_season;
  delete from public.hero_pair_totals where half_season = p_half_season;

  perform public.fill_hero_pair_aggregates(p_half_season);

  insert into public.hero_pair_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen. Returns
-- how many it rebuilt. One transaction, so a reader never sees half a rebuild.
create or replace function public.recompute_hero_pair_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct p.half_season from public.participants p order by 1 loop
    if public.rebuild_hero_pair_aggregates(h) then
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
create or replace function public.freeze_hero_pair_aggregates() returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.rebuild_hero_pair_aggregates(due.half_season, true)
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

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;

  delete from public.match_hero_kills k
  where public.participants_past_retention(k.half_season, k.played_at);

  return removed;
end
$$;

-- Hero pairs for a chosen set of modes, summed over those modes, one row per half-season, rank
-- bucket, kind and pair. It runs as its owner and reads only the two aggregate tables.
--  * `hero_pair_aggregates` keeps a pair only when its decided matches over every mode and bucket
--    reach `hero_pair_min_matches()`, so a subset of modes can leave a pair below the minimum; the
--    minimum is applied again here to the row's own sum.
--  * A rank bucket of 0 or more is returned only from the (half-season, mode, bucket) rows whose own
--    totals pass `community_bucket_shown`, checked before anything is summed. Distinct recorders
--    cannot be added across modes, and a gate on a combined figure would let a caller subtract one
--    list of modes from another and recover a hidden mode. Recorder counts are not returned.
--  * Rank bucket -1 (unknown) is returned ungated.
-- The rows come back in a stable order so a caller can page through them (PostgREST cuts a page at
-- 1000 rows).
create or replace function public.read_hero_pairs(
  p_play_mode_ids smallint[] default array[0, 1]::smallint[]
) returns table (
  half_season numeric,
  rank_bucket smallint,
  kind text,
  hero_id integer,
  other_hero_id integer,
  decided_matches integer,
  decided_lines integer,
  wins integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select x.half_season, x.rank_bucket, x.kind, x.hero_id, x.other_hero_id,
         sum(x.decided_matches)::integer,
         sum(x.decided_lines)::integer,
         sum(x.wins)::integer
  from public.hero_pair_aggregates x
  where x.play_mode_id = any (p_play_mode_ids)
    and (x.rank_bucket < 0
         or exists (
           select 1 from public.hero_pair_totals t
           where t.half_season = x.half_season
             and t.play_mode_id = x.play_mode_id
             and t.rank_bucket = x.rank_bucket
             and public.community_bucket_shown(t.matches, t.recorders, t.top_recorder_matches)))
  group by x.half_season, x.rank_bucket, x.kind, x.hero_id, x.other_hero_id
  having sum(x.decided_matches) >= public.hero_pair_min_matches()
  order by x.half_season, x.rank_bucket, x.kind, x.hero_id, x.other_hero_id
$$;

-- Checked when the migration runs, so a wrong constant or a leaking gate fails the push.
do $$
begin
  assert public.hero_pair_min_matches() > 0, 'a pair must need at least one decided match';
end
$$;

-- The gate is the privacy rule, so it is exercised on fixtures in a half-season that does not exist:
-- a bucket of one recorder (mode 0) and a bucket of three (mode 1), each with one 10-match pair. Only
-- the second may come back, alone and in a list of both modes. The fixtures are rolled back by the
-- sentinel exception (P0042). Nothing but a failed assertion can fail the push: if the fixtures
-- cannot be written for any other reason, the check is skipped with a warning.
do $$
declare
  checked boolean := false;
  one_recorder_returned boolean;
  both_modes_matches integer;
begin
  begin
    insert into public.hero_pair_aggregates
      (half_season, play_mode_id, rank_bucket, kind, hero_id, other_hero_id, matches, decided_matches, decided_lines, wins)
    values (99.0, 0, 0, 'vs', 1, 2, 10, 10, 10, 5), (99.0, 1, 0, 'vs', 1, 2, 10, 10, 10, 5);
    insert into public.hero_pair_totals
      (half_season, play_mode_id, rank_bucket, matches, decided_matches, recorders, top_recorder_matches)
    values (99.0, 0, 0, 10, 10, 1, 10), (99.0, 1, 0, 10, 10, 3, 5);

    select exists (select 1 from public.read_hero_pairs(array[0]::smallint[]) r where r.half_season = 99.0)
      into one_recorder_returned;
    select coalesce(sum(r.decided_matches), 0) into both_modes_matches
      from public.read_hero_pairs(array[0, 1]::smallint[]) r
      where r.half_season = 99.0;
    checked := true;

    raise exception 'roll back the gate fixtures' using errcode = 'P0042';
  exception
    when sqlstate 'P0042' then null;
    when others then
      raise warning 'hero pair gate check skipped (%)', sqlerrm;
  end;

  if checked then
    assert not one_recorder_returned, 'a one-recorder rank bucket must be hidden';
    assert both_modes_matches = 10, 'only the bucket that passes may be returned, whatever modes are asked for';
  end if;
end
$$;

-- Postgres grants EXECUTE to everyone on a new function. The reader is for the publishable key (the
-- `anon` role) and the service role, as `read_hero_matchups` is; everything else is for the service
-- role and the scheduler only.
revoke execute on function public.hero_pair_min_matches() from public, anon, authenticated;
revoke execute on function public.fill_hero_pair_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_hero_pair_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_hero_pair_aggregates() from public, anon, authenticated;
revoke execute on function public.freeze_hero_pair_aggregates() from public, anon, authenticated;
revoke execute on function public.purge_expired_participants() from public, anon, authenticated;
revoke execute on function public.read_hero_pairs(smallint[]) from public, anon, authenticated;
grant execute on function public.hero_pair_min_matches() to service_role;
grant execute on function public.fill_hero_pair_aggregates(numeric) to service_role;
grant execute on function public.rebuild_hero_pair_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_hero_pair_aggregates() to service_role;
grant execute on function public.freeze_hero_pair_aggregates() to service_role;
grant execute on function public.purge_expired_participants() to service_role;
grant execute on function public.read_hero_pairs(smallint[]) to anon, service_role;

-- Fill the tables now, so the first comparison with a direct count needs no waiting. Half-seasons
-- whose raw rows are already purged cannot be filled.
select public.recompute_hero_pair_aggregates();

-- Rebuild hourly, at a different minute from the other families, where pg_cron is already installed.
-- The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-hero-pair-aggregates';
    perform cron.schedule('recompute-hero-pair-aggregates', '43 * * * *', 'select public.recompute_hero_pair_aggregates()');
  else
    raise warning 'pg_cron is not installed: hero pair aggregates are rebuilt only when the purge freezes a half-season';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): hero pair aggregates are rebuilt only when the purge freezes a half-season', sqlerrm;
end
$$;
