-- Reads the specialists and flex players in well under a second (issue 826). Same answer, same signature, same
-- grants as `read_hero_specialists()` in 20261111120000_hero_specialists.sql (issue 819): only the way it is
-- worked out changes. Additive only: no table is touched, nothing is stored, and the eight rule helpers stay.
--
-- Why it took 36 seconds on 9,536 lines. The first version set up its steps as separate named queries that
-- were joined back together on a person and a hero. Postgres had no way to count the rows of a query built on
-- `distinct on` over a join, guessed one row, and so planned a nested loop: for each of the 7,525 counted lines
-- it re-read all 6,872 person-and-hero groups (and re-built the per-person totals every time), about 100
-- million comparisons. The data was never the problem (18,962 buffers).
--
-- This version has no join that depends on such a guess. It reads `participants` once; a match's mode and
-- recorder come from a window over the match, as `fill_hero_aggregates` reads them; each person's totals come
-- from a window over their hero rows; and the recorders behind a group are carried as a list on the person's
-- hero row instead of being looked up again through a join. The only joins left are the small role lookup and
-- the final pairing of a hero's two buckets.
--
-- The rules are untouched, so the definition on the website and the fixture check
-- (supabase/checks/hero_specialists.sql) still hold.

create or replace function public.read_hero_specialists() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with matched as (
    -- A match is its roster fingerprint plus its start time. Its mode and recorder belong to the match, so
    -- each is read once per match, over every line of it, before any line is left out.
    select p.id, p.half_season, p.uid, p.fingerprint, p.played_at, p.hero_id, p.is_win,
           coalesce(min(p.play_mode_id) over match, -1) as play_mode_id,
           min(p.recorded_by) over match as recorder
    from public.participants p
    window match as (partition by p.fingerprint, p.played_at)
  ),
  -- One line per person per counted match. `distinct on` guards a uid that appears twice in a match.
  lines as (
    select distinct on (p.half_season, btrim(p.uid), p.fingerprint, p.played_at)
           p.half_season,
           btrim(p.uid) as uid,
           coalesce(r.base_game_id, p.hero_id) as hero_id,
           p.is_win,
           p.recorder
    from matched p
    left join public.hero_game_roles r on r.game_id = p.hero_id
    where btrim(p.uid) <> ''
      and p.is_win is not null
      and p.hero_id > 0
      and p.play_mode_id in (0, 1)
    order by p.half_season, btrim(p.uid), p.fingerprint, p.played_at, p.id
  ),
  person_hero as (
    select l.half_season, l.uid, l.hero_id,
           count(*) as n,
           count(*) filter (where l.is_win) as wins,
           array_agg(distinct l.recorder) as recorders
    from lines l
    group by l.half_season, l.uid, l.hero_id
  ),
  classified as (
    select ph.half_season, ph.uid, ph.hero_id, ph.n, ph.wins, ph.recorders,
           case
             when ph.n * 100 >= ph.total * public.hero_specialist_min_share_percent()
                  and ph.n >= public.hero_specialist_min_hero_matches() then 'specialist'
             when ph.top * 100 < ph.total * public.hero_flex_max_top_share_percent()
                  and ph.heroes >= public.hero_flex_min_heroes()
                  and ph.total >= public.hero_flex_min_matches() then 'flex'
           end as bucket
    from (
      select h.*,
             sum(h.n) over person as total,
             max(h.n) over person as top,
             count(*) over person as heroes
      from person_hero h
      window person as (partition by h.half_season, h.uid)
    ) ph
  ),
  pooled as (
    select c.half_season, c.hero_id, c.bucket,
           sum(c.n) as matches,
           sum(c.wins) as wins,
           count(*) as people
    from classified c
    where c.bucket is not null
    group by c.half_season, c.hero_id, c.bucket
  ),
  pooled_recorders as (
    select c.half_season, c.hero_id, c.bucket, count(distinct r.recorder) as recorders
    from classified c
    cross join lateral unnest(c.recorders) as r(recorder)
    where c.bucket is not null
    group by c.half_season, c.hero_id, c.bucket
  ),
  shown as (
    select b.half_season, b.hero_id, b.bucket, b.matches, b.wins
    from pooled b
    join pooled_recorders pr
      on pr.half_season = b.half_season and pr.hero_id = b.hero_id and pr.bucket = b.bucket
    where b.people >= public.hero_specialist_min_players()
      and pr.recorders >= public.hero_specialist_min_recorders()
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

-- `create or replace` keeps the grants of the function it replaces; they are restated so this file stands on
-- its own.
revoke execute on function public.read_hero_specialists() from public, anon, authenticated;
grant execute on function public.read_hero_specialists() to service_role;
