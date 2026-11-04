-- Issues 457 and 178: who contributed to the hero figures, in numbers only, the rule that decides when
-- a figure may be published, the two functions the website reads through, and room for per-hero
-- ability and ultimate use counts. Figures describe the people who upload, so with few uploaders a
-- hero's figure would be one person's own stats.
--
-- Additive: new columns with a default of 0 (so a row that exists today, frozen ones included, reads
-- as not qualifying until it is rebuilt), one new table for raw counts and one for their aggregates,
-- new functions, and `fill_extended_aggregates`, `rebuild_extended_aggregates` and
-- `recompute_extended_aggregates` restated with the same signatures. `purge_expired_participants`,
-- `record_match_participants` and `record_match_extras` are not touched: the purge keeps calling the
-- freeze, which keeps calling the rebuild restated here.

-- The one rule for publishing a hero figure or a kill pair. To change a starting value, restate this
-- function in a new migration: the counts it reads are stored, so nothing needs rebuilding. The
-- website keeps its own minimums beside it; see "Who contributed" in docs/supabase.md.
create or replace function public.hero_figure_qualifies(
  p_matches integer,
  p_recorders integer,
  p_top_recorder_matches integer
) returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_matches >= 10 and p_recorders >= 3 and p_top_recorder_matches * 2 <= p_matches
$$;

-- A wrong rule fails the push rather than publishing someone's numbers.
do $$
begin
  assert public.hero_figure_qualifies(10, 3, 5), 'the starting values must qualify';
  assert not public.hero_figure_qualifies(9, 3, 4), 'too few matches must be hidden';
  assert not public.hero_figure_qualifies(10, 2, 5), 'too few players must be hidden';
  assert not public.hero_figure_qualifies(10, 3, 6), 'a player above half must be hidden';
  assert not public.hero_figure_qualifies(0, 0, 0), 'a row with no counts must be hidden';
end
$$;

-- Distinct players per hero, and the segments of the one with most. The per-figure pairs exist
-- because a figure can be missing for some players; each counts the segments that carried the figure.
alter table public.hero_figure_aggregates
  add column if not exists recorders integer not null default 0,
  add column if not exists top_recorder_segments integer not null default 0,
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

-- One row per hero and ability slot the recorder's app watched in a match. It belongs to the recorder's
-- own `participants` line, so retention and `forget_player` reach it through the foreign key. A slot
-- the app did not watch has no row; `uses` 0 is a real "never used". kills_after and assists_after are
-- null when the app did not count them, never 0 in their place.
create table if not exists public.participant_hero_ability_uses (
  participant_id bigint not null references public.participants (id) on delete cascade,
  hero_id integer not null check (hero_id > 0),
  slot text not null check (slot in (
    'ability_0', 'ability_1', 'ability_2', 'ability_3', 'ability_4', 'team_up_0', 'team_up_1', 'ultimate'
  )),
  uses integer not null check (uses between 0 and 999),
  kills_after integer check (kills_after between 0 and 999),
  assists_after integer check (assists_after between 0 and 999),
  recorded_at timestamptz not null default now(),
  primary key (participant_id, hero_id, slot)
);

-- Per half-season, mode, hero and slot, counts only. `uses_timed_sum` and `seconds_sum` cover exactly
-- the segments with a time played on that hero, so uses per minute has a numerator and denominator
-- over the same segments. Each `_n` is the segments that carried that count.
create table if not exists public.hero_ability_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  hero_id integer not null,
  slot text not null,
  segments integer not null,
  uses_sum bigint not null,
  uses_timed_sum bigint not null,
  seconds_sum bigint not null,
  kills_after_sum bigint not null,
  kills_after_n integer not null,
  assists_after_sum bigint not null,
  assists_after_n integer not null,
  recorders integer not null,
  top_recorder_segments integer not null,
  primary key (half_season, play_mode_id, hero_id, slot),
  constraint hero_ability_aggregates_counts_consistent check (
    kills_after_n <= segments and assists_after_n <= segments and top_recorder_segments <= segments
  )
);

alter table public.participant_hero_ability_uses enable row level security;
alter table public.hero_ability_aggregates enable row level security;
revoke all on public.participant_hero_ability_uses from anon, authenticated;
revoke all on public.hero_ability_aggregates from anon, authenticated;
grant select, insert, update, delete on public.participant_hero_ability_uses to service_role;
grant select, insert, update, delete on public.hero_ability_aggregates to service_role;

-- Stores the recorder's own ability and ultimate counts for one match and returns the rows written. A
-- function of its own, because `record_match_extras` is called by the deployed Edge Function and a
-- second overload of it would fail those calls with PGRST203. Safe to repeat: the first upload wins.
create or replace function public.record_match_ability_uses(
  p_fingerprint text,
  p_played_at timestamptz,
  p_recorder_uid text,
  p_ability_uses jsonb default '[]'::jsonb
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  recorder_line bigint;
  written integer := 0;
begin
  if p_recorder_uid is null or jsonb_typeof(p_ability_uses) <> 'array' then
    return 0;
  end if;

  -- A different lock seed from the other two record functions, so they never wait on each other.
  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint, 2));

  -- The same 4 minute window `record_match_participants` uses to call two uploads one match. Only the
  -- recorder's own line is ever written to.
  select p.id into recorder_line
  from public.participants p
  where p.fingerprint = p_fingerprint
    and p.uid = p_recorder_uid
    and p.played_at between p_played_at - interval '4 minutes' and p_played_at + interval '4 minutes'
  order by abs(extract(epoch from p.played_at - p_played_at)), p.id
  limit 1;

  if not found then
    return 0;
  end if;

  insert into public.participant_hero_ability_uses
    (participant_id, hero_id, slot, uses, kills_after, assists_after)
  select recorder_line, x.hero_id, x.slot, x.uses,
         case when x.kills_after between 0 and 999 then x.kills_after end,
         case when x.assists_after between 0 and 999 then x.assists_after end
  from jsonb_to_recordset(p_ability_uses) as x(
    hero_id integer, slot text, uses integer, kills_after integer, assists_after integer
  )
  where x.hero_id > 0
    and x.uses between 0 and 999
    and x.slot in ('ability_0', 'ability_1', 'ability_2', 'ability_3', 'ability_4', 'team_up_0', 'team_up_1', 'ultimate')
  on conflict (participant_id, hero_id, slot) do nothing;
  get diagnostics written = row_count;

  return written;
end
$$;

-- The extended aggregates with these changes, all in this one statement:
--
--  * Recorders. A hero segment belongs to the player whose figures it is: the `uid` of the
--    `participants` line it hangs off. It is NOT `recorded_by`, which is whoever uploaded first.
--  * All-zero segments. A segment with time played and no figure above 0 looks like figures the feed
--    never sent (overlay issue 1161), so it is left out entirely. A support with 0 damage and real
--    healing is kept.
--  * Time played. A figure counts only on segments that also have a time above 0, so its sum, count
--    and seconds describe the same segments. A segment with a figure and no usable time would
--    otherwise add damage and no seconds, inflating per minute.
--  * Kill-feed recorders. A feed is stored once per match with no recorder on it. Its recorder is the
--    player whose figures were written in the same `record_match_extras` call: one transaction, so
--    their `recorded_at` is the same instant. A feed with no such figures may belong to a player who
--    is already counted, so it is never a recorder of its own and its matches are charged to the
--    busiest attributed recorder. The rule can only err toward hiding.
--  * Ability and ultimate counts, from the recorder's own rows.
create or replace function public.fill_extended_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with match_lines as materialized (
    -- Mode belongs to the match, so it is read once per match rather than trusted line by line.
    select p.id, p.uid as recorder,
           coalesce(min(p.play_mode_id) over (partition by p.fingerprint, p.played_at), -1)::smallint as play_mode_id
    from public.participants p
    where p.half_season = p_half_season
  ),
  lines as materialized (
    select f.hero_id, f.seconds, f.damage_dealt, f.healing, f.damage_blocked, m.play_mode_id, m.recorder
    from public.participant_hero_figures f
    join match_lines m on m.id = f.participant_id
    where not (
      coalesce(f.seconds, 0) > 0
      and coalesce(f.damage_dealt, 0) = 0
      and coalesce(f.healing, 0) = 0
      and coalesce(f.damage_blocked, 0) = 0
    )
  ),
  figures as (
    insert into public.hero_figure_aggregates
      (half_season, play_mode_id, hero_id, segments, seconds_sum, seconds_n,
       damage_sum, damage_n, damage_seconds, healing_sum, healing_n, healing_seconds,
       blocked_sum, blocked_n, blocked_seconds,
       recorders, top_recorder_segments,
       damage_recorders, damage_top_recorder_n, healing_recorders, healing_top_recorder_n,
       blocked_recorders, blocked_top_recorder_n)
    select p_half_season, x.play_mode_id, x.hero_id,
           sum(x.segments)::integer,
           sum(x.seconds_sum)::bigint, sum(x.seconds_n)::integer,
           sum(x.damage_sum)::bigint, sum(x.damage_n)::integer, sum(x.damage_seconds)::bigint,
           sum(x.healing_sum)::bigint, sum(x.healing_n)::integer, sum(x.healing_seconds)::bigint,
           sum(x.blocked_sum)::bigint, sum(x.blocked_n)::integer, sum(x.blocked_seconds)::bigint,
           count(*)::integer, max(x.segments)::integer,
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
  ),
  abilities as (
    insert into public.hero_ability_aggregates
      (half_season, play_mode_id, hero_id, slot, segments, uses_sum, uses_timed_sum, seconds_sum,
       kills_after_sum, kills_after_n, assists_after_sum, assists_after_n, recorders, top_recorder_segments)
    select p_half_season, x.play_mode_id, x.hero_id, x.slot,
           sum(x.segments)::integer, sum(x.uses_sum)::bigint, sum(x.uses_timed_sum)::bigint, sum(x.seconds_sum)::bigint,
           sum(x.kills_after_sum)::bigint, sum(x.kills_after_n)::integer,
           sum(x.assists_after_sum)::bigint, sum(x.assists_after_n)::integer,
           count(*)::integer, max(x.segments)::integer
    from (
      select m.play_mode_id, u.hero_id, u.slot, m.recorder,
             count(*) as segments,
             sum(u.uses) as uses_sum,
             coalesce(sum(u.uses) filter (where f.seconds > 0), 0) as uses_timed_sum,
             coalesce(sum(f.seconds) filter (where f.seconds > 0), 0) as seconds_sum,
             coalesce(sum(u.kills_after), 0) as kills_after_sum, count(u.kills_after) as kills_after_n,
             coalesce(sum(u.assists_after), 0) as assists_after_sum, count(u.assists_after) as assists_after_n
      from public.participant_hero_ability_uses u
      join match_lines m on m.id = u.participant_id
      left join public.participant_hero_figures f on f.participant_id = u.participant_id and f.hero_id = u.hero_id
      group by m.play_mode_id, u.hero_id, u.slot, m.recorder
    ) x
    group by x.play_mode_id, x.hero_id, x.slot
    returning 1
  )
  select 1
$$;

-- As in 20261030120100, with the ability aggregates emptied and their raw rows counted as raw rows.
create or replace function public.rebuild_extended_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('extended_aggregates', 0));

  if exists (
    select 1 from public.extended_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not (
    exists (
      select 1 from public.participant_hero_figures f
      join public.participants p on p.id = f.participant_id
      where p.half_season = p_half_season
    )
    or exists (
      select 1 from public.participant_hero_ability_uses u
      join public.participants p on p.id = u.participant_id
      where p.half_season = p_half_season
    )
    or exists (select 1 from public.match_hero_kills where half_season = p_half_season)
  ) then
    return false;
  end if;

  delete from public.hero_figure_aggregates where half_season = p_half_season;
  delete from public.hero_kill_aggregates where half_season = p_half_season;
  delete from public.hero_kill_totals where half_season = p_half_season;
  delete from public.hero_ability_aggregates where half_season = p_half_season;

  perform public.fill_extended_aggregates(p_half_season);

  insert into public.extended_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- As in 20261030120100, with the half-seasons that hold ability rows included.
create or replace function public.recompute_extended_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in
    select due.half_season from (
      select p.half_season from public.participant_hero_figures f
        join public.participants p on p.id = f.participant_id
      union
      select p.half_season from public.participant_hero_ability_uses u
        join public.participants p on p.id = u.participant_id
      union
      select k.half_season from public.match_hero_kills k
    ) due
    order by 1
  loop
    if public.rebuild_extended_aggregates(h) then
      rebuilt := rebuilt + 1;
    end if;
  end loop;
  return rebuilt;
end
$$;

-- The one way the website reads the hero figures. It runs as its owner and returns one jsonb value
-- (so PostgREST's 1000-row page limit never cuts the answer short). A figure is returned only when
-- `hero_figure_qualifies` passes for that figure's own lines and recorders, per half-season and mode,
-- checked before any modes are summed so one list of modes cannot be subtracted from another to
-- recover a hidden one. A figure that fails is sent as zero lines, sum and seconds, and a hero whose
-- three figures all fail is absent. No recorder count, uid, name or per-player row is returned.
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
        select public.hero_figure_qualifies(a.damage_n, a.damage_recorders, a.damage_top_recorder_n) as damage,
               public.hero_figure_qualifies(a.healing_n, a.healing_recorders, a.healing_top_recorder_n) as healing,
               public.hero_figure_qualifies(a.blocked_n, a.blocked_recorders, a.blocked_top_recorder_n) as blocked
      ) s
      where s.damage or s.healing or s.blocked
    ), '[]'::jsonb)
  )
$$;

-- The one way the website reads the kill feed: the hero pairs that pass `hero_figure_qualifies` over
-- the stored feeds that had them. A pair that fails is absent. Recorder counts are not returned.
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
      where public.hero_figure_qualifies(a.matches, a.recorders, a.top_recorder_matches)
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; these are for the service role (the web
-- server, the Edge Function and the scheduler) and nobody else, the publishable key included.
revoke execute on function public.hero_figure_qualifies(integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.record_match_ability_uses(text, timestamptz, text, jsonb) from public, anon, authenticated;
revoke execute on function public.fill_extended_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_extended_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_extended_aggregates() from public, anon, authenticated;
revoke execute on function public.read_community_hero_figures() from public, anon, authenticated;
revoke execute on function public.read_community_kill_feed() from public, anon, authenticated;
grant execute on function public.hero_figure_qualifies(integer, integer, integer) to service_role;
grant execute on function public.record_match_ability_uses(text, timestamptz, text, jsonb) to service_role;
grant execute on function public.fill_extended_aggregates(numeric) to service_role;
grant execute on function public.rebuild_extended_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_extended_aggregates() to service_role;
grant execute on function public.read_community_hero_figures() to service_role;
grant execute on function public.read_community_kill_feed() to service_role;

-- Rebuild the half-seasons that still have raw rows and are not frozen, so the new columns are filled
-- now. A frozen half-season keeps its columns at 0, which does not qualify.
select public.recompute_extended_aggregates();
