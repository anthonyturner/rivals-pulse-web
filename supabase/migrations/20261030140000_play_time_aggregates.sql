-- Issue 173: when the community plays and wins. Counts of a recorder's own matches by weekday, by
-- four-hour block of the day and by place in a play session, kept per half-season as anonymous
-- counts only. No player id, uid, name, fingerprint or per-match row is stored here.
--
-- Source: `tracked_matches`, the recorder's own match history, because it is the only place that
-- holds the recorder's own result (`performance.is_win`) next to their own match times. The
-- scoreboard rows in `participants` do not say which line is the recorder's. Each tracked match is
-- one recorder's play of one match, so a match two recorders played counts once for each of them;
-- the issue's rule is "each match counts once per recorder". A player in `do_not_store` is left out.
--
-- Time zone: every day and hour is UTC. The upload carries no offset to use instead.
--
-- Recompute and freeze, on this feature's own hourly job: `recompute_play_time_aggregates` rebuilds
-- every half-season that is not frozen from scratch (running it twice changes nothing) and freezes a
-- half-season once it has ended and the late-upload grace has passed. `purge_expired_participants`
-- is not touched: nothing here reads `participants`, and `tracked_matches` is not purged by half-season.
--
-- Additive: no existing table is touched and no function changes its signature.

-- Idle time between the end of one of a recorder's matches and the start of the next that ends a play
-- session. A match that starts later than this after the previous one ended opens a new session.
create or replace function public.play_session_gap() returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 minutes' $$;

-- Session positions 1, 2, 3 and then "4 or later" share one bucket, so a long evening cannot spread
-- one player across many thin buckets.
create or replace function public.play_session_position_cap() returns integer
language sql
immutable
set search_path = ''
as $$ select 4 $$;

-- Only Quick Match (0) and Competitive (1) count, as for hero stats. A match whose mode is unknown
-- is left out: the game reports bot practice as Quick Match, so an unlabelled one may not be real play.
-- The matches still count toward a session's order, because they were played in the sitting.
create or replace function public.play_time_mode_ids() returns smallint[]
language sql
immutable
set search_path = ''
as $$ select array[0, 1]::smallint[] $$;

-- Upload accepts a match up to 7 days old, so a half-season is frozen only this long after it ended.
create or replace function public.play_time_freeze_grace() returns interval
language sql
immutable
set search_path = ''
as $$ select interval '8 days' $$;

-- One row per half-season that has been aggregated.
create table if not exists public.play_time_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Null while the half-season is still rebuilt every hour.
  frozen_at timestamptz
);

-- One row per half-season, dimension and bucket (see `fill_play_time_aggregates` for the meaning of
-- the bucket number). `recorders` is how many different players recorded the matches, a count only;
-- it lets the site hold a bucket back until it is not one person's diary.
create table if not exists public.play_time_aggregates (
  half_season numeric(4,1) not null,
  dimension text not null,
  bucket smallint not null,
  matches integer not null,
  -- Matches with a win or a loss.
  decided_matches integer not null,
  wins integer not null,
  recorders integer not null,
  primary key (half_season, dimension, bucket),
  constraint play_time_aggregates_bucket_in_range check (
    (dimension = 'weekday' and bucket between 1 and 7)
    or (dimension = 'time_of_day' and bucket between 0 and 5)
    or (dimension = 'session_position' and bucket between 1 and 4)
  ),
  constraint play_time_aggregates_counts_consistent check (
    wins <= decided_matches and decided_matches <= matches and recorders between 1 and matches
  )
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key.
alter table public.play_time_aggregate_half_seasons enable row level security;
alter table public.play_time_aggregates enable row level security;
revoke all on public.play_time_aggregate_half_seasons from anon, authenticated;
revoke all on public.play_time_aggregates from anon, authenticated;
grant select, insert, update, delete on public.play_time_aggregate_half_seasons to service_role;
grant select, insert, update, delete on public.play_time_aggregates to service_role;

-- Every tracked match with the figures the buckets need, and its place in its recorder's session.
-- The recorder (`player_id`) exists only in this result and in the grouping that counts it; it is
-- never stored. Work is done over all of a recorder's matches before a half-season is picked, so a
-- session that crosses a half-season boundary is numbered as one.
--
-- Match start is the end time minus the duration; with no duration the start is the end.
-- Half-season is the payload's, else the half-season whose start is the latest one before the match.
create or replace function public.play_time_matches() returns table (
  player_id bigint,
  started_at timestamptz,
  half_season numeric,
  play_mode_id smallint,
  is_win boolean,
  session_position integer
)
language sql
stable
set search_path = ''
as $$
  with m as (
    select t.id, t.player_id, t.played_at,
           t.played_at - make_interval(secs => least(greatest(coalesce(
             case when jsonb_typeof(t.raw_payload -> 'match_play_duration') = 'number'
                  then (t.raw_payload ->> 'match_play_duration')::double precision end, 0), 0), 86400)) as started_at,
           coalesce(
             case when jsonb_typeof(t.raw_payload -> 'match_season') = 'number'
                       and (t.raw_payload ->> 'match_season')::numeric between 0 and 99
                  then (t.raw_payload ->> 'match_season')::numeric(4,1) end,
             (select h.half_season from public.half_seasons h
              where h.starts_at <= t.played_at order by h.starts_at desc limit 1)
           ) as match_half_season,
           case when jsonb_typeof(t.raw_payload -> 'play_mode_id') = 'number'
                     and (t.raw_payload ->> 'play_mode_id')::numeric between 0 and 99
                then (t.raw_payload ->> 'play_mode_id')::numeric::smallint end as mode_id,
           case when jsonb_typeof(t.performance -> 'is_win') = 'boolean'
                then (t.performance ->> 'is_win')::boolean end as won
    from public.tracked_matches t
    join public.players pl on pl.id = t.player_id
    where t.played_at is not null
      and not exists (
        select 1 from public.do_not_store d
        where (d.kind = 'uid' and d.key = t.performance ->> 'player_uid')
           or (d.kind = 'name' and d.key = pl.normalized_name)
      )
  ),
  gaps as (
    select m.*,
           coalesce(
             m.started_at - lag(m.played_at) over (partition by m.player_id order by m.played_at, m.id)
               > public.play_session_gap(),
             true) as opens_session
    from m
  ),
  sessions as (
    select g.*,
           count(*) filter (where g.opens_session)
             over (partition by g.player_id order by g.played_at, g.id) as session_no
    from gaps g
  ),
  positioned as (
    select s.*,
           row_number() over (partition by s.player_id, s.session_no order by s.played_at, s.id) as position_in_session
    from sessions s
  )
  select p.player_id, p.started_at, p.match_half_season, p.mode_id, p.won, p.position_in_session::integer
  from positioned p
  where p.match_half_season is not null
$$;

-- Writes one half-season's buckets. The caller has emptied the half-season's rows first.
--
-- Bucket numbers: weekday is the ISO day, 1 Monday to 7 Sunday; time_of_day is the four-hour block
-- 0 (00:00 to 03:59) to 5 (20:00 to 23:59); session_position is 1, 2, 3 or 4 for the fourth match
-- of a sitting and every one after it. All of them read the match's start time in UTC.
create or replace function public.fill_play_time_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  insert into public.play_time_aggregates
    (half_season, dimension, bucket, matches, decided_matches, wins, recorders)
  select p_half_season, d.dimension, d.bucket,
         count(*),
         count(m.is_win),
         count(*) filter (where m.is_win),
         count(distinct m.player_id)
  from public.play_time_matches() m
  cross join lateral (
    values
      ('weekday', extract(isodow from timezone('UTC', m.started_at))::smallint),
      ('time_of_day', floor(extract(hour from timezone('UTC', m.started_at)) / 4)::smallint),
      ('session_position', least(m.session_position, public.play_session_position_cap())::smallint)
  ) as d(dimension, bucket)
  where m.half_season = p_half_season
    and m.play_mode_id = any (public.play_time_mode_ids())
  group by d.dimension, d.bucket
$$;

-- A half-season is settled once the next one began and the late-upload grace has passed.
create or replace function public.play_time_half_season_settled(p_half_season numeric) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.half_seasons h
    where h.half_season > p_half_season
      and h.starts_at + public.play_time_freeze_grace() <= now()
  )
$$;

-- Rebuilds one half-season's buckets and optionally freezes it. Returns false, and changes nothing,
-- when the half-season is already frozen or no match of it is left to count (so a rebuild can never
-- wipe counts that have outlived their matches).
create or replace function public.rebuild_play_time_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('play_time_aggregates', 0));

  if exists (
    select 1 from public.play_time_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.play_time_matches() m where m.half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.play_time_aggregates where half_season = p_half_season;

  perform public.fill_play_time_aggregates(p_half_season);

  insert into public.play_time_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that has matches and is not frozen, and freezes the
-- ones that are settled. Returns how many it rebuilt. One transaction, so a reader never sees half
-- a rebuild.
create or replace function public.recompute_play_time_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct m.half_season from public.play_time_matches() m order by 1 loop
    if public.rebuild_play_time_aggregates(h, public.play_time_half_season_settled(h)) then
      rebuilt := rebuilt + 1;
    end if;
  end loop;
  return rebuilt;
end
$$;

-- The one way the website reads the buckets. It runs as its owner, reads only the aggregate table, and
-- returns counts only. One jsonb value instead of a set of rows, so PostgREST's 1000-row page limit
-- never cuts the answer short. The session gap travels with it so the page can state it.
create or replace function public.read_community_insights() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'session_gap_minutes', extract(epoch from public.play_session_gap()) / 60,
    'buckets', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'dimension', a.dimension,
               'bucket', a.bucket,
               'matches', a.matches,
               'decided_matches', a.decided_matches,
               'wins', a.wins,
               'recorders', a.recorders)
             order by a.half_season, a.dimension, a.bucket)
      from public.play_time_aggregates a
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; every one of these is for the service role
-- and the scheduler only.
revoke execute on function public.play_session_gap() from public, anon, authenticated;
revoke execute on function public.play_session_position_cap() from public, anon, authenticated;
revoke execute on function public.play_time_mode_ids() from public, anon, authenticated;
revoke execute on function public.play_time_freeze_grace() from public, anon, authenticated;
revoke execute on function public.play_time_matches() from public, anon, authenticated;
revoke execute on function public.fill_play_time_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.play_time_half_season_settled(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_play_time_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_play_time_aggregates() from public, anon, authenticated;
revoke execute on function public.read_community_insights() from public, anon, authenticated;
grant execute on function public.play_session_gap() to service_role;
grant execute on function public.play_session_position_cap() to service_role;
grant execute on function public.play_time_mode_ids() to service_role;
grant execute on function public.play_time_freeze_grace() to service_role;
grant execute on function public.play_time_matches() to service_role;
grant execute on function public.fill_play_time_aggregates(numeric) to service_role;
grant execute on function public.play_time_half_season_settled(numeric) to service_role;
grant execute on function public.rebuild_play_time_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_play_time_aggregates() to service_role;
grant execute on function public.read_community_insights() to service_role;

-- Fill the tables now, so the first comparison with a direct count needs no waiting.
select public.recompute_play_time_aggregates();

-- Rebuild hourly where pg_cron is already installed. The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-play-time-aggregates';
    perform cron.schedule('recompute-play-time-aggregates', '37 * * * *', 'select public.recompute_play_time_aggregates()');
  else
    raise warning 'pg_cron is not installed: play-time aggregates are rebuilt only by hand';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): play-time aggregates are rebuilt only by hand', sqlerrm;
end
$$;
