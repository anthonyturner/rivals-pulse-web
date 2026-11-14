-- Issue 178: the recorder gate for the extended aggregates, and the two functions the website reads
-- them through. Per-minute figures and kill-feed counters describe the people who upload, so with a
-- handful of uploaders a hero's damage per minute would be one person's own stats. Epic 170's rule
-- therefore applies: a bucket is public only with at least 3 distinct recorders and no recorder
-- above half of it (`community_bucket_shown`, from 20261031020000). Counts only, never who.
--
-- Additive: new columns with a default of 0 (so every row that exists today, frozen ones included,
-- reads as hidden until it is rebuilt), a restated `fill_extended_aggregates` with the same
-- signature, and two new read functions. `purge_expired_participants`, `record_match_participants`
-- and `record_match_extras` are not touched: the purge keeps calling the freeze, which keeps calling
-- the fill restated here.

-- Per figure, because a figure can be missing for some recorders: the distinct recorders whose
-- segments carried it, and the segments of the one who carried most. Segments are those with the
-- figure AND a time played (see `fill_extended_aggregates`).
alter table public.hero_figure_aggregates
  add column if not exists damage_recorders integer not null default 0,
  add column if not exists damage_top_recorder_n integer not null default 0,
  add column if not exists healing_recorders integer not null default 0,
  add column if not exists healing_top_recorder_n integer not null default 0,
  add column if not exists blocked_recorders integer not null default 0,
  add column if not exists blocked_top_recorder_n integer not null default 0;

-- Per pair: the distinct recorders whose stored feeds had it, and the feeds of the one with most.
alter table public.hero_kill_aggregates
  add column if not exists recorders integer not null default 0,
  add column if not exists top_recorder_matches integer not null default 0;

-- The extended aggregates of 20261030120100 with three changes, all in this one statement:
--
--  * Recorders. A hero segment belongs to the player whose figures it is: the `uid` of the
--    `participants` line it hangs off (that line is the recorder's own, which is how the figures
--    were tied to it). It is NOT `recorded_by`, which is whoever uploaded the match first.
--  * Time played. A figure now counts only on segments that also have a time played above zero. Before,
--    a segment with a figure and no usable time (the upload drops a time outside 0 to 7200) added its
--    damage to the sum but nothing to `*_seconds`, which inflated per minute. The sum, the count
--    and the seconds of a figure now describe exactly the same segments.
--  * Kill-feed recorders. A feed is stored once per match with no recorder on it. Its recorder is the
--    player whose upload stored it, found as the player whose hero figures were written in the same
--    call: `record_match_extras` writes both in one transaction, so their `recorded_at` is the same
--    instant. A feed with no such figures (the uploader sent a feed without segments, or their
--    figures were stored by an earlier upload) has an unknown recorder. It may belong to a player who
--    is already counted, so it is never a recorder of its own: only attributed recorders are
--    counted, and every unattributed feed is charged to the busiest attributed recorder. The gate
--    can therefore only err toward hiding, and a pair whose feeds are all unattributed has 0
--    recorders and stays hidden.
create or replace function public.fill_extended_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with lines as materialized (
    -- Mode belongs to the match, so it is read once per match rather than trusted line by line.
    select f.hero_id, f.seconds, f.damage_dealt, f.healing, f.damage_blocked,
           coalesce(m.play_mode_id, -1)::smallint as play_mode_id,
           m.recorder
    from public.participant_hero_figures f
    join (
      select p.id, p.uid as recorder,
             min(p.play_mode_id) over (partition by p.fingerprint, p.played_at) as play_mode_id
      from public.participants p
      where p.half_season = p_half_season
    ) m on m.id = f.participant_id
  ),
  figures as (
    insert into public.hero_figure_aggregates
      (half_season, play_mode_id, hero_id, segments, seconds_sum, seconds_n,
       damage_sum, damage_n, damage_seconds, healing_sum, healing_n, healing_seconds,
       blocked_sum, blocked_n, blocked_seconds,
       damage_recorders, damage_top_recorder_n, healing_recorders, healing_top_recorder_n,
       blocked_recorders, blocked_top_recorder_n)
    select p_half_season, x.play_mode_id, x.hero_id,
           sum(x.segments)::integer,
           sum(x.seconds_sum)::bigint, sum(x.seconds_n)::integer,
           sum(x.damage_sum)::bigint, sum(x.damage_n)::integer, sum(x.damage_seconds)::bigint,
           sum(x.healing_sum)::bigint, sum(x.healing_n)::integer, sum(x.healing_seconds)::bigint,
           sum(x.blocked_sum)::bigint, sum(x.blocked_n)::integer, sum(x.blocked_seconds)::bigint,
           (count(*) filter (where x.damage_n > 0))::integer, coalesce(max(x.damage_n), 0)::integer,
           (count(*) filter (where x.healing_n > 0))::integer, coalesce(max(x.healing_n), 0)::integer,
           (count(*) filter (where x.blocked_n > 0))::integer, coalesce(max(x.blocked_n), 0)::integer
    from (
      select l.play_mode_id, l.hero_id, l.recorder,
             count(*) as segments,
             coalesce(sum(l.seconds), 0) as seconds_sum, count(l.seconds) as seconds_n,
             coalesce(sum(l.damage_dealt) filter (where l.seconds > 0), 0) as damage_sum,
             count(l.damage_dealt) filter (where l.seconds > 0) as damage_n,
             coalesce(sum(l.seconds) filter (where l.damage_dealt is not null and l.seconds > 0), 0) as damage_seconds,
             coalesce(sum(l.healing) filter (where l.seconds > 0), 0) as healing_sum,
             count(l.healing) filter (where l.seconds > 0) as healing_n,
             coalesce(sum(l.seconds) filter (where l.healing is not null and l.seconds > 0), 0) as healing_seconds,
             coalesce(sum(l.damage_blocked) filter (where l.seconds > 0), 0) as blocked_sum,
             count(l.damage_blocked) filter (where l.seconds > 0) as blocked_n,
             coalesce(sum(l.seconds) filter (where l.damage_blocked is not null and l.seconds > 0), 0) as blocked_seconds
      from lines l
      group by l.play_mode_id, l.hero_id, l.recorder
    ) x
    group by x.play_mode_id, x.hero_id
    returning 1
  ),
  feeds as materialized (
    select k.fingerprint, k.played_at, min(k.recorded_at) as recorded_at
    from public.match_hero_kills k
    where k.half_season = p_half_season
    group by k.fingerprint, k.played_at
  ),
  feed_sources as materialized (
    -- Null when no recorder's figures were written in the same call as the feed.
    select f.fingerprint, f.played_at, min(r.uid) as source
    from feeds f
    left join (
      select p.fingerprint, p.played_at, p.uid, hf.recorded_at
      from public.participant_hero_figures hf
      join public.participants p on p.id = hf.participant_id
      where p.half_season = p_half_season and p.uid is not null
    ) r on r.fingerprint = f.fingerprint and r.played_at = f.played_at and r.recorded_at = f.recorded_at
    group by f.fingerprint, f.played_at
  ),
  pairs as (
    insert into public.hero_kill_aggregates
      (half_season, killer_hero, victim_hero, kills, matches, recorders, top_recorder_matches)
    select p_half_season, x.killer_hero, x.victim_hero,
           sum(x.kills)::bigint, sum(x.matches)::integer,
           count(x.source)::integer,
           (coalesce(max(x.matches) filter (where x.source is not null), 0)
            + coalesce(sum(x.matches) filter (where x.source is null), 0))::integer
    from (
      -- One row per attributed recorder of the feeds that had the pair, plus one row (null source)
      -- for all the unattributed feeds, which is not a recorder.
      select k.killer_hero, k.victim_hero, s.source, sum(k.kills) as kills, count(*) as matches
      from public.match_hero_kills k
      join feed_sources s on s.fingerprint = k.fingerprint and s.played_at = k.played_at
      where k.half_season = p_half_season
      group by k.killer_hero, k.victim_hero, s.source
    ) x
    group by x.killer_hero, x.victim_hero
    returning 1
  ),
  totals as (
    insert into public.hero_kill_totals (half_season, matches)
    select p_half_season, count(*) from feeds
    having count(*) > 0
    returning 1
  )
  select 1
$$;

-- The one way the website reads the hero figures. It runs as its owner and returns one jsonb value
-- (so PostgREST's 1000-row page limit never cuts the answer short). A figure is returned only when
-- `community_bucket_shown` passes for that figure's own lines and recorders; a figure that fails is
-- sent as zero lines, zero sum and zero seconds, which the website reads as "not enough data", and
-- a hero whose three figures all fail is absent. No total here includes a hidden figure, and no
-- recorder count, uid, name or per-player row is returned.
create or replace function public.read_community_hero_figures() returns jsonb
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
    'figures', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'hero_id', a.hero_id,
               'damage_sum', case when s.damage then a.damage_sum else 0 end,
               'damage_n', case when s.damage then a.damage_n else 0 end,
               'damage_seconds', case when s.damage then a.damage_seconds else 0 end,
               'healing_sum', case when s.healing then a.healing_sum else 0 end,
               'healing_n', case when s.healing then a.healing_n else 0 end,
               'healing_seconds', case when s.healing then a.healing_seconds else 0 end,
               'blocked_sum', case when s.blocked then a.blocked_sum else 0 end,
               'blocked_n', case when s.blocked then a.blocked_n else 0 end,
               'blocked_seconds', case when s.blocked then a.blocked_seconds else 0 end)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_figure_aggregates a
      cross join lateral (
        select public.community_bucket_shown(a.damage_n, a.damage_recorders, a.damage_top_recorder_n) as damage,
               public.community_bucket_shown(a.healing_n, a.healing_recorders, a.healing_top_recorder_n) as healing,
               public.community_bucket_shown(a.blocked_n, a.blocked_recorders, a.blocked_top_recorder_n) as blocked
      ) s
      where s.damage or s.healing or s.blocked
    ), '[]'::jsonb)
  )
$$;

-- The one way the website reads the kill feed: the hero pairs that pass `community_bucket_shown`
-- over the stored feeds that had them. A pair that fails is absent, and no figure here is a total
-- that includes one. Recorder counts are not returned.
create or replace function public.read_community_kill_feed() returns jsonb
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
    'pairs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'killer_hero', a.killer_hero,
               'victim_hero', a.victim_hero,
               'kills', a.kills,
               'matches', a.matches)
             order by a.half_season, a.killer_hero, a.victim_hero)
      from public.hero_kill_aggregates a
      where public.community_bucket_shown(a.matches, a.recorders, a.top_recorder_matches)
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; these are for the service role (the web
-- server and the scheduler) and nobody else, the publishable key included.
revoke execute on function public.fill_extended_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.read_community_hero_figures() from public, anon, authenticated;
revoke execute on function public.read_community_kill_feed() from public, anon, authenticated;
grant execute on function public.fill_extended_aggregates(numeric) to service_role;
grant execute on function public.read_community_hero_figures() to service_role;
grant execute on function public.read_community_kill_feed() to service_role;

-- Rebuild the half-seasons that still have raw rows and are not frozen, so the new columns are
-- filled now. A frozen half-season keeps its columns at 0, which stays hidden.
select public.recompute_extended_aggregates();
