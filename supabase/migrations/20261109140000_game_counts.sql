-- Game-level counts for /game-stats (issue 381): how many matches and how many different players
-- the site has seen in overlay uploads. Additive only: one new function, no table is touched.
--
-- Counts come from the raw `participants` rows, so they cover the matches still held under the
-- retention rule (`participants_past_retention`), the same window for matches and for players. A
-- match is its roster fingerprint plus its start time, as in `fill_hero_aggregates`, so the match
-- count agrees with the hero numbers. A player is the in-game uid, or the lower-cased trimmed name
-- where the game sent no uid; the two are never mixed up with each other.
--
-- Only counts leave the function: no uid, name, fingerprint or recorder. It is granted to the
-- service role alone, and the website reads it through its server.

create or replace function public.read_game_counts() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lines as (
    select p.half_season,
           p.fingerprint,
           p.played_at,
           case when p.uid is not null then 'uid:' || p.uid
                else 'name:' || lower(btrim(p.name)) end as player_key
    from public.participants p
  )
  select jsonb_build_object(
    'matches', (select count(distinct (l.fingerprint, l.played_at)) from lines l),
    'players', (select count(distinct l.player_key) from lines l),
    'since', (select min(l.played_at) from lines l),
    'half_seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', s.half_season,
               'matches', s.matches,
               'players', s.players)
             order by s.half_season desc)
      from (
        select l.half_season,
               count(distinct (l.fingerprint, l.played_at)) as matches,
               count(distinct l.player_key) as players
        from lines l
        group by l.half_season
      ) s
    ), '[]'::jsonb)
  )
$$;

-- Postgres grants EXECUTE to everyone on a new function; this one is for the service role only.
revoke execute on function public.read_game_counts() from public, anon, authenticated;
grant execute on function public.read_game_counts() to service_role;
