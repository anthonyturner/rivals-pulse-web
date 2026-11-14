-- Specialists against flex players (issue 819): per hero, the pooled record of the players who mostly play
-- that hero against the players who play many. Additive only: new functions, no table is touched.
--
-- Nothing is stored. The classification runs inside one query over the raw `participants` rows every
-- time the reader is called, so a `forget_player` or a purge applies at once and no per-player row is
-- ever kept (ADR-0006, decision 3). Only pooled buckets leave the function: a match and win count per
-- hero and bucket, with no uid, name, fingerprint or recorder, and only for a hero whose two buckets
-- both pass the gates. How many players or recorders stand behind a bucket is never returned.
--
-- Who counts. A person is an in-game uid; a line with no uid is left out, since a name is not a person.
-- A counted match is a match with a win or a loss in Quick Match (0) or Competitive (1), as in the hero
-- stats. A match is its roster fingerprint plus its start time, and its mode and recorder are read once
-- per match, as `fill_hero_aggregates` does. A match is "on" the hero the player ended it on, and
-- Deadpool's role forms count as one hero (1057, from `hero_game_roles`). Hero id 0 ("no hero recorded")
-- is not a hero.
--
-- Buckets, per half-season, over a person's counted matches in it:
--   specialist on H: at least `hero_specialist_min_share_percent()` percent of their counted matches
--                    are on H, and at least `hero_specialist_min_hero_matches()` of them
--   flex:            their most played hero is under `hero_flex_max_top_share_percent()` percent, they
--                    played at least `hero_flex_min_heroes()` heroes and have at least
--                    `hero_flex_min_matches()` counted matches; the bucket of H holds their matches on H
--   everyone else is left out of both buckets.
-- A bucket of H is shown only with at least `hero_specialist_min_players()` people, at least
-- `hero_specialist_min_recorders()` recorders and at least `hero_specialist_min_bucket_matches()`
-- matches, and a hero is returned only when both of its buckets are. Two people are too few: either
-- could subtract their own record from the total. The website prints the minimums and the definition
-- (src/server/heroes/specialists); a test compares them with this file.
--
-- Each half-season still held in `participants` is answered; the website picks the current one and falls
-- back to the previous one while no hero passes. Granted to the service role alone.

create or replace function public.hero_specialist_min_share_percent() returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

create or replace function public.hero_specialist_min_hero_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

create or replace function public.hero_flex_max_top_share_percent() returns integer
language sql
immutable
set search_path = ''
as $$ select 25 $$;

create or replace function public.hero_flex_min_heroes() returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

create or replace function public.hero_flex_min_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;

create or replace function public.hero_specialist_min_players() returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

create or replace function public.hero_specialist_min_recorders() returns integer
language sql
immutable
set search_path = ''
as $$ select 2 $$;

create or replace function public.hero_specialist_min_bucket_matches() returns integer
language sql
immutable
set search_path = ''
as $$ select 50 $$;

create or replace function public.read_hero_specialists() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with matches as materialized (
    select p.fingerprint, p.played_at,
           coalesce(min(p.play_mode_id), -1) as play_mode_id,
           min(p.recorded_by) as recorder
    from public.participants p
    group by p.fingerprint, p.played_at
  ),
  -- One line per person per counted match. `distinct on` guards a uid that appears twice in a match.
  lines as materialized (
    select distinct on (p.half_season, btrim(p.uid), p.fingerprint, p.played_at)
           p.half_season,
           btrim(p.uid) as uid,
           coalesce(r.base_game_id, p.hero_id) as hero_id,
           p.is_win,
           m.recorder
    from public.participants p
    join matches m on m.fingerprint = p.fingerprint and m.played_at = p.played_at
    left join public.hero_game_roles r on r.game_id = p.hero_id
    where btrim(p.uid) <> ''
      and p.is_win is not null
      and p.hero_id > 0
      and m.play_mode_id in (0, 1)
    order by p.half_season, btrim(p.uid), p.fingerprint, p.played_at, p.id
  ),
  person_hero as (
    select l.half_season, l.uid, l.hero_id, count(*) as n
    from lines l
    group by l.half_season, l.uid, l.hero_id
  ),
  people as (
    select ph.half_season, ph.uid, sum(ph.n) as total, max(ph.n) as top, count(*) as heroes
    from person_hero ph
    group by ph.half_season, ph.uid
  ),
  classified as (
    select ph.half_season, ph.uid, ph.hero_id,
           case
             when ph.n * 100 >= pe.total * public.hero_specialist_min_share_percent()
                  and ph.n >= public.hero_specialist_min_hero_matches() then 'specialist'
             when pe.top * 100 < pe.total * public.hero_flex_max_top_share_percent()
                  and pe.heroes >= public.hero_flex_min_heroes()
                  and pe.total >= public.hero_flex_min_matches() then 'flex'
           end as bucket
    from person_hero ph
    join people pe on pe.half_season = ph.half_season and pe.uid = ph.uid
  ),
  pooled as (
    select l.half_season, l.hero_id, c.bucket,
           count(*) as matches,
           count(*) filter (where l.is_win) as wins,
           count(distinct l.uid) as people,
           count(distinct l.recorder) as recorders
    from lines l
    join classified c on c.half_season = l.half_season and c.uid = l.uid and c.hero_id = l.hero_id
    where c.bucket is not null
    group by l.half_season, l.hero_id, c.bucket
  ),
  shown as (
    select b.half_season, b.hero_id, b.bucket, b.matches, b.wins
    from pooled b
    where b.people >= public.hero_specialist_min_players()
      and b.recorders >= public.hero_specialist_min_recorders()
      and b.matches >= public.hero_specialist_min_bucket_matches()
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'half_season', s.half_season,
           'hero_id', s.hero_id,
           'specialist_matches', s.matches,
           'specialist_wins', s.wins,
           'flex_matches', f.matches,
           'flex_wins', f.wins)
         order by s.half_season, s.hero_id), '[]'::jsonb)
  from shown s
  join shown f on f.half_season = s.half_season and f.hero_id = s.hero_id and f.bucket = 'flex'
  where s.bucket = 'specialist'
$$;

-- Postgres grants EXECUTE to everyone on a new function. The reader is for the service role alone; the
-- rule helpers are called by it as its owner, so no API role needs them.
revoke execute on function public.hero_specialist_min_share_percent() from public, anon, authenticated;
revoke execute on function public.hero_specialist_min_hero_matches() from public, anon, authenticated;
revoke execute on function public.hero_flex_max_top_share_percent() from public, anon, authenticated;
revoke execute on function public.hero_flex_min_heroes() from public, anon, authenticated;
revoke execute on function public.hero_flex_min_matches() from public, anon, authenticated;
revoke execute on function public.hero_specialist_min_players() from public, anon, authenticated;
revoke execute on function public.hero_specialist_min_recorders() from public, anon, authenticated;
revoke execute on function public.hero_specialist_min_bucket_matches() from public, anon, authenticated;
revoke execute on function public.read_hero_specialists() from public, anon, authenticated;
grant execute on function public.read_hero_specialists() to service_role;
