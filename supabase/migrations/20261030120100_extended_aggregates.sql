-- Issue 176: hero figures and kill-feed counts that survive the purge, the same recompute-and-freeze
-- pattern as the hero aggregates (issue 142). Raw rows (`participant_hero_figures`,
-- `match_hero_kills`) are deleted with the scoreboard rows they belong to; these tables keep what the
-- site needs from them as anonymous counts. No uid, name, fingerprint or per-player row is stored.
--
-- Recompute: `recompute_extended_aggregates` rebuilds every half-season that still has raw rows from
-- scratch, so a figure removed by `forget_player` shows up on the next run and running it twice
-- changes nothing. Freeze: `purge_expired_participants` calls `freeze_extended_aggregates` just
-- before it deletes, which rebuilds each half-season that is going one last time and marks it
-- frozen. A frozen half-season is never rebuilt again.
--
-- Additive: no existing table is touched. `purge_expired_participants` is restated with the same
-- signature (a body change) and calls the new freeze after the hero aggregates' own.

-- One row per half-season that has been aggregated here.
create table if not exists public.extended_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set by the purge when it freezes the half-season. Null while the half-season is still rebuilt.
  frozen_at timestamptz
);

-- Per half-season, game mode and hero: what the recorders who played that hero did with it. These are
-- the recorders' own figures, so a row describes people who upload, not the whole lobby. A figure is
-- a sum with the number of segments that had it, never an average, because a missing figure is not 0.
-- `*_seconds` is the time played in exactly the segments that had that figure, so per-minute is
-- `sum * 60 / seconds` with a numerator and denominator over the same segments. play_mode_id is the
-- match's mode (0 Quick Match, 1 Competitive, 2 Arcade, 3 Practice) or -1 when the game did not say.
create table if not exists public.hero_figure_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  hero_id integer not null,
  -- Hero segments counted: one recorder playing this hero in one match.
  segments integer not null,
  seconds_sum bigint not null,
  seconds_n integer not null,
  damage_sum bigint not null,
  damage_n integer not null,
  damage_seconds bigint not null,
  healing_sum bigint not null,
  healing_n integer not null,
  healing_seconds bigint not null,
  blocked_sum bigint not null,
  blocked_n integer not null,
  blocked_seconds bigint not null,
  primary key (half_season, play_mode_id, hero_id),
  constraint hero_figure_aggregates_counts_consistent check (
    seconds_n <= segments and damage_n <= segments and healing_n <= segments and blocked_n <= segments
  )
);

-- Per half-season, how often one hero killed another across the matches whose kill feed was stored,
-- and in how many matches that pair appeared. The recorder's client sees the feed, so a kill it did
-- not see is not counted: read these as "seen kills", not every kill.
create table if not exists public.hero_kill_aggregates (
  half_season numeric(4,1) not null,
  killer_hero text not null,
  victim_hero text not null,
  kills bigint not null,
  matches integer not null,
  primary key (half_season, killer_hero, victim_hero)
);

-- How many matches had a stored kill feed per half-season: the denominator for a pair's `matches`.
create table if not exists public.hero_kill_totals (
  half_season numeric(4,1) primary key,
  matches integer not null
);

alter table public.extended_aggregate_half_seasons enable row level security;
alter table public.hero_figure_aggregates enable row level security;
alter table public.hero_kill_aggregates enable row level security;
alter table public.hero_kill_totals enable row level security;
revoke all on public.extended_aggregate_half_seasons from anon, authenticated;
revoke all on public.hero_figure_aggregates from anon, authenticated;
revoke all on public.hero_kill_aggregates from anon, authenticated;
revoke all on public.hero_kill_totals from anon, authenticated;
grant select, insert, update, delete on public.extended_aggregate_half_seasons to service_role;
grant select, insert, update, delete on public.hero_figure_aggregates to service_role;
grant select, insert, update, delete on public.hero_kill_aggregates to service_role;
grant select, insert, update, delete on public.hero_kill_totals to service_role;

-- Writes the three count tables for one half-season from a single read of its raw rows, in one
-- statement, so they always describe the same set of rows. The caller has emptied the half-season's
-- rows first.
create or replace function public.fill_extended_aggregates(p_half_season numeric) returns void
language sql
set search_path = ''
as $$
  with figures as (
    insert into public.hero_figure_aggregates
      (half_season, play_mode_id, hero_id, segments, seconds_sum, seconds_n,
       damage_sum, damage_n, damage_seconds, healing_sum, healing_n, healing_seconds,
       blocked_sum, blocked_n, blocked_seconds)
    select p_half_season, l.play_mode_id, l.hero_id,
           count(*),
           coalesce(sum(l.seconds), 0), count(l.seconds),
           coalesce(sum(l.damage_dealt), 0), count(l.damage_dealt),
           coalesce(sum(l.seconds) filter (where l.damage_dealt is not null), 0),
           coalesce(sum(l.healing), 0), count(l.healing),
           coalesce(sum(l.seconds) filter (where l.healing is not null), 0),
           coalesce(sum(l.damage_blocked), 0), count(l.damage_blocked),
           coalesce(sum(l.seconds) filter (where l.damage_blocked is not null), 0)
    from (
      -- Mode belongs to the match, so it is read once per match rather than trusted line by line.
      select f.hero_id, f.seconds, f.damage_dealt, f.healing, f.damage_blocked,
             coalesce(m.play_mode_id, -1)::smallint as play_mode_id
      from public.participant_hero_figures f
      join (
        select p.id, min(p.play_mode_id) over (partition by p.fingerprint, p.played_at) as play_mode_id
        from public.participants p
        where p.half_season = p_half_season
      ) m on m.id = f.participant_id
    ) l
    group by l.play_mode_id, l.hero_id
    returning 1
  ),
  pairs as (
    insert into public.hero_kill_aggregates (half_season, killer_hero, victim_hero, kills, matches)
    select p_half_season, k.killer_hero, k.victim_hero, sum(k.kills), count(*)
    from public.match_hero_kills k
    where k.half_season = p_half_season
    group by k.killer_hero, k.victim_hero
    returning 1
  ),
  totals as (
    insert into public.hero_kill_totals (half_season, matches)
    select p_half_season, count(*)
    from (
      select distinct k.fingerprint, k.played_at
      from public.match_hero_kills k
      where k.half_season = p_half_season
    ) matches_with_feed
    having count(*) > 0
    returning 1
  )
  select 1
$$;

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts the purge has already preserved).
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
    or exists (select 1 from public.match_hero_kills where half_season = p_half_season)
  ) then
    return false;
  end if;

  delete from public.hero_figure_aggregates where half_season = p_half_season;
  delete from public.hero_kill_aggregates where half_season = p_half_season;
  delete from public.hero_kill_totals where half_season = p_half_season;

  perform public.fill_extended_aggregates(p_half_season);

  insert into public.extended_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen. Returns
-- how many it rebuilt. One transaction, so a reader never sees half a rebuild.
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

-- Rebuilds and freezes every half-season about to lose raw rows. Called by
-- `purge_expired_participants` BEFORE it deletes anything, which is the only thing that keeps these
-- counts when the raw rows go: any later migration that restates the purge must keep calling it.
-- The retention rule holds for a half-season when it holds for its oldest row, so it is asked once
-- per half-season. A half-season counts as going when either kind of raw row is past retention.
create or replace function public.freeze_extended_aggregates() returns void
language sql
set search_path = ''
as $$
  select public.rebuild_extended_aggregates(due.half_season, true)
  from (
    select p.half_season from public.participants p
    group by p.half_season
    having public.participants_past_retention(p.half_season, min(p.played_at))
    union
    select k.half_season from public.match_hero_kills k
    group by k.half_season
    having public.participants_past_retention(k.half_season, min(k.played_at))
  ) due
$$;

-- The purge of issue 142 with one step added: the extended aggregates are frozen too, ahead of the
-- delete. Raw hero figures leave through the foreign key with their scoreboard line; the kill feed
-- has no scoreboard line to follow, so it is deleted by the same retention rule. Returns the
-- scoreboard rows deleted, as before.
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

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;

  delete from public.match_hero_kills k
  where public.participants_past_retention(k.half_season, k.played_at);

  return removed;
end
$$;

revoke execute on function public.fill_extended_aggregates(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_extended_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_extended_aggregates() from public, anon, authenticated;
revoke execute on function public.freeze_extended_aggregates() from public, anon, authenticated;
revoke execute on function public.purge_expired_participants() from public, anon, authenticated;
grant execute on function public.fill_extended_aggregates(numeric) to service_role;
grant execute on function public.rebuild_extended_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_extended_aggregates() to service_role;
grant execute on function public.freeze_extended_aggregates() to service_role;
grant execute on function public.purge_expired_participants() to service_role;

-- Rebuild hourly, at a different minute from the hero aggregates, where pg_cron is already
-- installed. The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-extended-aggregates';
    perform cron.schedule('recompute-extended-aggregates', '13 * * * *', 'select public.recompute_extended_aggregates()');
  else
    raise warning 'pg_cron is not installed: extended aggregates are rebuilt only when the purge freezes a half-season';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): extended aggregates are rebuilt only when the purge freezes a half-season', sqlerrm;
end
$$;
