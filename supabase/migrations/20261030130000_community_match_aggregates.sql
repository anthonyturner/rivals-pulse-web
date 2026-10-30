-- Issue 172: what the Community Matches tab shows (win rate by map, the mode mix, average match
-- length, matches per day), kept as anonymous counts that outlive the raw rows. Nothing here stores
-- a uid, a name, a fingerprint or a per-player row; a count is the finest thing a table holds.
--
-- Recompute and freeze, on its own hourly job. `recompute_community_match_aggregates` rebuilds every
-- half-season that still has raw rows and is not frozen, from scratch, so a late result shows up on
-- the next run and running it twice changes nothing. A half-season is frozen, and never rebuilt
-- again, once it is over (see `community_match_freeze_due`). It is frozen long before
-- `purge_expired_participants` deletes its rows, so this migration does not touch that function.
--
-- Additive: no existing table is touched and no function changes its signature.

-- One row per half-season that has been aggregated.
create table if not exists public.community_match_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set when the half-season is frozen. Null while it is still rebuilt each hour.
  frozen_at timestamptz
);

-- Per half-season, game mode and map. play_mode_id is 0 Quick Match, 1 Competitive, 2 Arcade,
-- 3 Practice or -1 when the game did not say (a key cannot hold a null). A match with no map is not
-- here. Win rates are not stored, only the counts they come from.
create table if not exists public.community_map_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  map_name text not null,
  -- Distinct matches on this map.
  matches integer not null,
  -- Of those, the matches whose result from the recorder's side is known, and how many were won.
  decided_matches integer not null,
  wins integer not null,
  primary key (half_season, play_mode_id, map_name),
  constraint community_map_aggregates_counts_consistent check (
    wins <= decided_matches and decided_matches <= matches
  )
);

-- Per half-season and mode: how many matches, and the length of those whose length is known. The
-- sum comes with the count it was summed over, so a missing length is never averaged in as zero.
create table if not exists public.community_mode_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  matches integer not null,
  duration_sum_seconds bigint not null,
  duration_n integer not null,
  primary key (half_season, play_mode_id),
  constraint community_mode_aggregates_counts_consistent check (duration_n <= matches)
);

-- Per half-season and day (UTC): how many matches ended that day.
create table if not exists public.community_day_aggregates (
  half_season numeric(4,1) not null,
  day date not null,
  matches integer not null,
  primary key (half_season, day)
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key. Only the
-- service role reaches these tables, and the website reads them through one function.
alter table public.community_match_half_seasons enable row level security;
alter table public.community_map_aggregates enable row level security;
alter table public.community_mode_aggregates enable row level security;
alter table public.community_day_aggregates enable row level security;
revoke all on public.community_match_half_seasons from anon, authenticated;
revoke all on public.community_map_aggregates from anon, authenticated;
revoke all on public.community_mode_aggregates from anon, authenticated;
revoke all on public.community_day_aggregates from anon, authenticated;
grant select, insert, update, delete on public.community_match_half_seasons to service_role;
grant select, insert, update, delete on public.community_map_aggregates to service_role;
grant select, insert, update, delete on public.community_mode_aggregates to service_role;
grant select, insert, update, delete on public.community_day_aggregates to service_role;

-- Whether a half-season's counts should be frozen now. Two reasons, either enough:
--  * the next half-season began a week ago. A live upload is refused once the match is a week old,
--    so nothing new can arrive for a half-season a week after it ended;
--  * the oldest raw row is five months old. The purge's own six-month limit would otherwise start
--    deleting rows from a half-season whose end was never recorded in `half_seasons`, and a rebuild
--    from what is left would shrink the counts.
create or replace function public.community_match_freeze_due(p_half_season numeric) returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
           select min(h.starts_at) <= now() - interval '7 days'
           from public.half_seasons h
           where h.half_season > p_half_season
         ), false)
      or exists (
           select 1 from public.participants p
           where p.half_season = p_half_season and p.played_at < now() - interval '5 months'
         )
$$;

-- Writes all three count tables for one half-season from a single read of its raw rows, in one
-- statement, so they always describe the same set of matches. The caller has emptied them first.
--
-- A match is its roster fingerprint plus its start time (the same roster can play again later), and
-- counts once however many lines it has or players recorded it. Mode and map belong to the match, so
-- each is read once per match.
--
-- The result of a match is read from the recorder's side: `tracked_matches` keeps what the recorder
-- saw (their own win or loss, and the match length), and the recorder's line in `participants` is
-- found by their in-game uid, which stays inside this function. When recorders on both teams
-- uploaded the same match they disagree, so the earliest upload is the one that counts: a match has
-- one result, never both a win and a loss. A match with no recorder line to find (a masked player,
-- a tracked row already trimmed) has no known result and no known length; it still counts as a
-- match, but not in a win rate or an average. A recorder's row is the same match when it is within
-- the four minutes `record_match_participants` treats as one match.
create or replace function public.fill_community_match_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with m as materialized (
    select p.fingerprint, p.played_at,
           coalesce(min(p.play_mode_id), -1)::smallint as play_mode_id,
           min(p.map_name) as map_name
    from public.participants p
    where p.half_season = p_half_season
    group by p.fingerprint, p.played_at
  ),
  seen as materialized (
    select m.fingerprint, m.played_at, t.recorded_at, t.id,
           case when jsonb_typeof(t.performance -> 'is_win') = 'boolean'
                then (t.performance ->> 'is_win')::boolean end as recorder_won,
           case when jsonb_typeof(t.raw_payload -> 'match_play_duration') = 'number'
                then (t.raw_payload ->> 'match_play_duration')::numeric end as duration
    from m
    join public.participants p
      on p.fingerprint = m.fingerprint and p.played_at = m.played_at and p.uid is not null
    join public.tracked_matches t
      on t.performance ->> 'player_uid' = p.uid
     and t.played_at between m.played_at - interval '4 minutes' and m.played_at + interval '4 minutes'
  ),
  results as (
    select distinct on (s.fingerprint, s.played_at) s.fingerprint, s.played_at, s.recorder_won
    from seen s
    where s.recorder_won is not null
    order by s.fingerprint, s.played_at, s.recorded_at, s.id
  ),
  lengths as (
    select distinct on (s.fingerprint, s.played_at) s.fingerprint, s.played_at, s.duration
    from seen s
    where s.duration > 0
    order by s.fingerprint, s.played_at, s.recorded_at, s.id
  ),
  facts as materialized (
    select m.play_mode_id, m.map_name, m.played_at, r.recorder_won, l.duration
    from m
    left join results r on r.fingerprint = m.fingerprint and r.played_at = m.played_at
    left join lengths l on l.fingerprint = m.fingerprint and l.played_at = m.played_at
  ),
  maps as (
    insert into public.community_map_aggregates
      (half_season, play_mode_id, map_name, matches, decided_matches, wins)
    select p_half_season, f.play_mode_id, f.map_name,
           count(*),
           count(f.recorder_won),
           count(*) filter (where f.recorder_won)
    from facts f
    where f.map_name is not null
    group by f.play_mode_id, f.map_name
    returning 1
  ),
  modes as (
    insert into public.community_mode_aggregates
      (half_season, play_mode_id, matches, duration_sum_seconds, duration_n)
    select p_half_season, f.play_mode_id,
           count(*),
           coalesce(round(sum(f.duration)), 0)::bigint,
           count(f.duration)
    from facts f
    group by f.play_mode_id
    returning 1
  ),
  days as (
    insert into public.community_day_aggregates (half_season, day, matches)
    select p_half_season, (f.played_at at time zone 'UTC')::date, count(*)
    from facts f
    group by 2
    returning 1
  )
  select 1
$$;

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts that outlived their rows).
create or replace function public.rebuild_community_match_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('community_match_aggregates', 0));

  if exists (
    select 1 from public.community_match_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.participants where half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.community_map_aggregates where half_season = p_half_season;
  delete from public.community_mode_aggregates where half_season = p_half_season;
  delete from public.community_day_aggregates where half_season = p_half_season;

  perform public.fill_community_match_aggregates(p_half_season);

  insert into public.community_match_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen, and
-- freezes the ones that are due. Returns how many it rebuilt. One transaction, so a reader never
-- sees half a rebuild.
create or replace function public.recompute_community_match_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct p.half_season from public.participants p order by 1 loop
    if public.rebuild_community_match_aggregates(h, public.community_match_freeze_due(h)) then
      rebuilt := rebuilt + 1;
    end if;
  end loop;
  return rebuilt;
end
$$;

-- The one way the website reads these counts. It runs as its owner and returns one jsonb value (so
-- PostgREST's 1000-row page limit never cuts the answer short), made only of counts and the start
-- date of each half-season. Rates, shares and averages are derived in code.
create or replace function public.read_community_matches() returns jsonb
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
    'modes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'matches', a.matches,
               'duration_sum_seconds', a.duration_sum_seconds,
               'duration_n', a.duration_n)
             order by a.half_season, a.play_mode_id)
      from public.community_mode_aggregates a
    ), '[]'::jsonb),
    'maps', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'map_name', a.map_name,
               'matches', a.matches,
               'decided_matches', a.decided_matches,
               'wins', a.wins)
             order by a.half_season, a.play_mode_id, a.map_name)
      from public.community_map_aggregates a
    ), '[]'::jsonb),
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'day', a.day,
               'matches', a.matches)
             order by a.half_season, a.day)
      from public.community_day_aggregates a
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; these are for the service role (the web
-- server and the scheduler) and nobody else, the publishable key included.
revoke execute on function public.community_match_freeze_due(numeric) from public, anon, authenticated;
revoke execute on function public.fill_community_match_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_community_match_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_community_match_aggregates() from public, anon, authenticated;
revoke execute on function public.read_community_matches() from public, anon, authenticated;
grant execute on function public.community_match_freeze_due(numeric) to service_role;
grant execute on function public.fill_community_match_aggregates(numeric) to service_role;
grant execute on function public.rebuild_community_match_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_community_match_aggregates() to service_role;
grant execute on function public.read_community_matches() to service_role;

-- Fill the tables now, so the first comparison with a direct count needs no waiting.
select public.recompute_community_match_aggregates();

-- Rebuild hourly where pg_cron is already installed. The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-community-match-aggregates';
    perform cron.schedule('recompute-community-match-aggregates', '17 * * * *', 'select public.recompute_community_match_aggregates()');
  else
    raise warning 'pg_cron is not installed: community match aggregates are not rebuilt on a schedule';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): community match aggregates are not rebuilt on a schedule', sqlerrm;
end
$$;
