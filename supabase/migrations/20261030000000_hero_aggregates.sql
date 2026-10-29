-- Issue 142: hero counts that survive the purge. Raw scoreboard rows in `participants` are deleted
-- once the half-season after their own has ended; these tables keep what the site needs from them,
-- as anonymous counts only. No uid, name, fingerprint or per-player row is stored here.
--
-- Recompute and freeze: `recompute_hero_aggregates` rebuilds every half-season that still has raw
-- rows from scratch, so a late result, or a player removed by `forget_player`, shows up on the next
-- run and running it twice changes nothing. `purge_expired_participants` rebuilds a half-season one
-- last time and freezes it just before it deletes from it. A frozen half-season is never rebuilt
-- again, so its counts keep the contribution of anyone forgotten after the freeze (no uid is left
-- in them to find it by).
--
-- Additive. Nothing reads these tables yet (shadow mode): the read path is issue 144.

-- One row per half-season that has been aggregated.
create table if not exists public.hero_aggregate_half_seasons (
  half_season numeric(4,1) primary key,
  computed_at timestamptz not null,
  -- Set by the purge when it freezes the half-season. Null while the half-season is still rebuilt.
  frozen_at timestamptz
);

-- Per half-season, game mode and hero. play_mode_id is the match's mode (0 Quick Match, 1 Competitive,
-- 2 Arcade, 3 Practice) or -1 when the game did not say; the key cannot hold a null. Rates are not
-- stored: every `_sum` comes with the `_n` of lines that had that figure, because final hits are null
-- for older apps and must never be averaged as zero.
create table if not exists public.hero_aggregates (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  hero_id integer not null,
  -- Scoreboard lines of this hero, and how many of them have a win or loss.
  lines integer not null,
  decided_lines integer not null,
  wins integer not null,
  -- Distinct matches this hero appeared in. A hero on both teams adds 2 lines and 1 match.
  matches integer not null,
  decided_matches integer not null,
  kills_sum bigint not null,
  kills_n integer not null,
  deaths_sum bigint not null,
  deaths_n integer not null,
  assists_sum bigint not null,
  assists_n integer not null,
  final_hits_sum bigint not null,
  final_hits_n integer not null,
  primary key (half_season, play_mode_id, hero_id),
  constraint hero_aggregates_counts_consistent check (
    wins <= decided_lines and decided_lines <= lines
    and decided_matches <= matches and matches <= lines
  )
);

-- How many distinct matches were counted per half-season and mode: the pick rate's denominator.
create table if not exists public.hero_aggregate_totals (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  matches integer not null,
  decided_matches integer not null,
  primary key (half_season, play_mode_id),
  constraint hero_aggregate_totals_counts_consistent check (decided_matches <= matches)
);

-- Hero against enemy hero, per half-season and mode: hero_id on one team, enemy_hero_id on the other,
-- results from hero_id's side. One encounter is one hero_id line facing one hero on the other team,
-- so a hero fighting itself adds 2 decided lines (one win, one loss) and 1 match. Only matchups with
-- at least `hero_matchup_min_matches()` decided matches are stored: thinner ones are never published.
create table if not exists public.hero_matchups (
  half_season numeric(4,1) not null,
  play_mode_id smallint not null,
  hero_id integer not null,
  enemy_hero_id integer not null,
  matches integer not null,
  decided_matches integer not null,
  decided_lines integer not null,
  wins integer not null,
  primary key (half_season, play_mode_id, hero_id, enemy_hero_id),
  constraint hero_matchups_counts_consistent check (
    wins <= decided_lines and decided_matches <= matches and decided_matches <= decided_lines
  )
);

-- Same posture as `participants`: RLS on, no policy, nothing for the publishable key.
alter table public.hero_aggregate_half_seasons enable row level security;
alter table public.hero_aggregates enable row level security;
alter table public.hero_aggregate_totals enable row level security;
alter table public.hero_matchups enable row level security;
revoke all on public.hero_aggregate_half_seasons from anon, authenticated;
revoke all on public.hero_aggregates from anon, authenticated;
revoke all on public.hero_aggregate_totals from anon, authenticated;
revoke all on public.hero_matchups from anon, authenticated;

-- The smallest number of decided matches a matchup needs to be stored. The per-hero minimum (also
-- 10, the tier rule) is applied where tiers are derived, not here: hero rows are stored whole.
create or replace function public.hero_matchup_min_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- Retention (privacy policy section 7), moved out of `purge_expired_participants` unchanged so the
-- purge and the freeze that precedes it cannot disagree about which rows are going.
create or replace function public.participants_past_retention(
  p_half_season numeric,
  p_played_at timestamptz
) returns boolean
language sql
stable
set search_path = ''
as $$
  select p_played_at < now() - interval '6 months'
      or exists (
        select 1 from public.half_seasons h
        where h.half_season = p_half_season + 1 and h.starts_at <= now()
      )
$$;

-- The scoreboard lines of one half-season, with each match numbered and its mode settled. A match is
-- its roster fingerprint plus its start time (the same roster can play again later), and mode belongs
-- to the match, so it is read once per match rather than trusted line by line.
create or replace function public.hero_aggregate_lines(p_half_season numeric)
returns table (
  line_id bigint,
  match_no bigint,
  play_mode_id smallint,
  team smallint,
  hero_id integer,
  kills integer,
  deaths integer,
  assists integer,
  final_hits integer,
  is_win boolean
)
language sql
stable
set search_path = ''
as $$
  select p.id,
         dense_rank() over (order by p.fingerprint, p.played_at),
         coalesce(min(p.play_mode_id) over (partition by p.fingerprint, p.played_at), -1)::smallint,
         p.team, p.hero_id, p.kills, p.deaths, p.assists, p.final_hits, p.is_win
  from public.participants p
  where p.half_season = p_half_season
$$;

-- Rebuilds one half-season's counts from its raw rows and optionally freezes it. Returns false, and
-- changes nothing, when the half-season is already frozen or has no raw rows left (so a rebuild can
-- never wipe counts the purge has already preserved).
create or replace function public.rebuild_hero_aggregates(
  p_half_season numeric,
  p_freeze boolean default false
) returns boolean
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('hero_aggregates', 0));

  if exists (
    select 1 from public.hero_aggregate_half_seasons
    where half_season = p_half_season and frozen_at is not null
  ) or not exists (
    select 1 from public.participants where half_season = p_half_season
  ) then
    return false;
  end if;

  delete from public.hero_aggregates where half_season = p_half_season;
  delete from public.hero_aggregate_totals where half_season = p_half_season;
  delete from public.hero_matchups where half_season = p_half_season;

  insert into public.hero_aggregates
    (half_season, play_mode_id, hero_id, lines, decided_lines, wins, matches, decided_matches,
     kills_sum, kills_n, deaths_sum, deaths_n, assists_sum, assists_n, final_hits_sum, final_hits_n)
  select p_half_season, l.play_mode_id, l.hero_id,
         count(*),
         count(l.is_win),
         count(*) filter (where l.is_win),
         count(distinct l.match_no),
         count(distinct l.match_no) filter (where l.is_win is not null),
         coalesce(sum(l.kills), 0), count(l.kills),
         coalesce(sum(l.deaths), 0), count(l.deaths),
         coalesce(sum(l.assists), 0), count(l.assists),
         coalesce(sum(l.final_hits), 0), count(l.final_hits)
  from public.hero_aggregate_lines(p_half_season) l
  where l.hero_id is not null
  group by l.play_mode_id, l.hero_id;

  insert into public.hero_aggregate_totals (half_season, play_mode_id, matches, decided_matches)
  select p_half_season, l.play_mode_id,
         count(distinct l.match_no),
         count(distinct l.match_no) filter (where l.is_win is not null)
  from public.hero_aggregate_lines(p_half_season) l
  group by l.play_mode_id;

  insert into public.hero_matchups
    (half_season, play_mode_id, hero_id, enemy_hero_id, matches, decided_matches, decided_lines, wins)
  select p_half_season, e.play_mode_id, e.hero_id, e.enemy_hero_id,
         count(distinct e.match_no),
         count(distinct e.match_no) filter (where e.is_win is not null),
         count(*) filter (where e.is_win is not null),
         count(*) filter (where e.is_win)
  from (
    -- Each line once per enemy hero it faced, however many players on the other team picked it.
    select distinct a.line_id, a.match_no, a.play_mode_id, a.hero_id, b.hero_id as enemy_hero_id, a.is_win
    from public.hero_aggregate_lines(p_half_season) a
    join public.hero_aggregate_lines(p_half_season) b on b.match_no = a.match_no and b.team <> a.team
    where a.hero_id is not null and b.hero_id is not null
  ) e
  group by e.play_mode_id, e.hero_id, e.enemy_hero_id
  having count(distinct e.match_no) filter (where e.is_win is not null) >= public.hero_matchup_min_matches();

  insert into public.hero_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (p_half_season, now(), case when p_freeze then now() end)
  on conflict (half_season) do update
    set computed_at = excluded.computed_at, frozen_at = excluded.frozen_at;

  return true;
end
$$;

-- The scheduled job: rebuilds every half-season that still has raw rows and is not frozen. Returns
-- how many it rebuilt. One transaction, so a reader never sees half a rebuild.
create or replace function public.recompute_hero_aggregates() returns integer
language plpgsql
set search_path = ''
as $$
declare
  rebuilt integer := 0;
  h numeric;
begin
  for h in select distinct p.half_season from public.participants p order by 1 loop
    if public.rebuild_hero_aggregates(h) then
      rebuilt := rebuilt + 1;
    end if;
  end loop;
  return rebuilt;
end
$$;

-- Retention (privacy policy section 7): a row goes when the half-season after its own has ended,
-- and in any case six months after the match. Returns the rows deleted.
--
-- The only change from the version in 20261009000000_participants.sql: before deleting, every
-- half-season that has rows to delete is rebuilt and frozen while its rows still exist (nothing runs
-- when nothing is due), and the retention rule itself now lives in `participants_past_retention`.
-- The signature, the return value and the rule are unchanged.
create or replace function public.purge_expired_participants() returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  perform public.rebuild_hero_aggregates(due.half_season, true)
  from (
    select distinct p.half_season from public.participants p
    where public.participants_past_retention(p.half_season, p.played_at)
  ) due;

  delete from public.participants p
  where public.participants_past_retention(p.half_season, p.played_at);
  get diagnostics removed = row_count;
  return removed;
end
$$;

-- Postgres grants EXECUTE to everyone on a new function; these are for the service role and the
-- scheduler only. `create or replace` of the purge keeps its grants, so they are only stated for the new ones.
revoke execute on function public.hero_matchup_min_matches() from public, anon, authenticated;
revoke execute on function public.participants_past_retention(numeric, timestamptz) from public, anon, authenticated;
revoke execute on function public.hero_aggregate_lines(numeric) from public, anon, authenticated;
revoke execute on function public.rebuild_hero_aggregates(numeric, boolean) from public, anon, authenticated;
revoke execute on function public.recompute_hero_aggregates() from public, anon, authenticated;
grant execute on function public.hero_matchup_min_matches() to service_role;
grant execute on function public.participants_past_retention(numeric, timestamptz) to service_role;
grant execute on function public.hero_aggregate_lines(numeric) to service_role;
grant execute on function public.rebuild_hero_aggregates(numeric, boolean) to service_role;
grant execute on function public.recompute_hero_aggregates() to service_role;

-- Fill the tables now, so the first comparison with a direct count needs no waiting.
select public.recompute_hero_aggregates();

-- Rebuild hourly where pg_cron is already installed. The extension is not created here.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recompute-hero-aggregates';
    perform cron.schedule('recompute-hero-aggregates', '7 * * * *', 'select public.recompute_hero_aggregates()');
  else
    raise warning 'pg_cron is not installed: hero aggregates are rebuilt only when the purge freezes a half-season';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): hero aggregates are rebuilt only when the purge freezes a half-season', sqlerrm;
end
$$;
