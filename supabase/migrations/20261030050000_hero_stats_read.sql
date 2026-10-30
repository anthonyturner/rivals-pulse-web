-- Issue 144: the one way the website reads the hero aggregates. The four aggregate tables keep RLS on
-- with no policy and no grant for the publishable key, so these two functions are the only door:
-- both run as their owner (security definer), read nothing but the aggregate tables and
-- `half_seasons`, and return counts only. No uid, name, fingerprint or per-player row exists in
-- anything they can reach.
--
-- Each returns one jsonb value instead of a set of rows, so PostgREST's 1000-row page limit never
-- cuts the answer short.
--
-- Additive: no existing table or function changes.

-- Every figure the hero stat derivation reads, one entry per half-season, mode and hero, and one
-- entry per half-season and mode for the number of matches counted. Rates are derived in code from
-- these counts. `half_seasons` supplies each half-season's start (its end is the next start).
create or replace function public.read_hero_stats() returns jsonb
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
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', t.half_season,
               'play_mode_id', t.play_mode_id,
               'decided_matches', t.decided_matches)
             order by t.half_season, t.play_mode_id)
      from public.hero_aggregate_totals t
    ), '[]'::jsonb),
    'heroes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'half_season', a.half_season,
               'play_mode_id', a.play_mode_id,
               'hero_id', a.hero_id,
               'decided_lines', a.decided_lines,
               'wins', a.wins,
               'kills_sum', a.kills_sum, 'kills_n', a.kills_n,
               'deaths_sum', a.deaths_sum, 'deaths_n', a.deaths_n,
               'assists_sum', a.assists_sum, 'assists_n', a.assists_n,
               'final_hits_sum', a.final_hits_sum, 'final_hits_n', a.final_hits_n)
             order by a.half_season, a.play_mode_id, a.hero_id)
      from public.hero_aggregates a
    ), '[]'::jsonb)
  )
$$;

-- Hero against enemy hero for a chosen set of modes, summed over those modes. `hero_matchups` keeps
-- a matchup only when its decided matches summed over every mode reach `hero_matchup_min_matches()`,
-- so a subset of modes can leave a matchup below the minimum; the minimum is applied again here to
-- the subset's own sum, and a thinner matchup is not returned.
create or replace function public.read_hero_matchups(
  p_play_mode_ids smallint[] default array[0, 1]::smallint[]
) returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'half_season', m.half_season,
           'hero_id', m.hero_id,
           'enemy_hero_id', m.enemy_hero_id,
           'decided_matches', m.decided_matches,
           'decided_lines', m.decided_lines,
           'wins', m.wins)
         order by m.half_season, m.hero_id, m.enemy_hero_id), '[]'::jsonb)
  from (
    select x.half_season, x.hero_id, x.enemy_hero_id,
           sum(x.decided_matches) as decided_matches,
           sum(x.decided_lines) as decided_lines,
           sum(x.wins) as wins
    from public.hero_matchups x
    where x.play_mode_id = any (p_play_mode_ids)
    group by x.half_season, x.hero_id, x.enemy_hero_id
    having sum(x.decided_matches) >= public.hero_matchup_min_matches()
  ) m
$$;

-- Postgres grants EXECUTE to everyone on a new function; these two are for the publishable key
-- (the `anon` role) and the service role. Nothing else is granted.
revoke execute on function public.read_hero_stats() from public, anon, authenticated;
revoke execute on function public.read_hero_matchups(smallint[]) from public, anon, authenticated;
grant execute on function public.read_hero_stats() to anon, service_role;
grant execute on function public.read_hero_matchups(smallint[]) to anon, service_role;
