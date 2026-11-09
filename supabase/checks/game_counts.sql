-- Checks `read_game_counts()` of 20261109140000_game_counts.sql (issue 381): the totals agree with the
-- raw rows, each half-season's matches add up to the total, and no half-season has more players than
-- the whole. It changes nothing (it ends in a rollback).
--
-- Run it against the project after the migration is applied:
--   npx supabase db query --linked -f supabase/checks/game_counts.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  counts jsonb := public.read_game_counts();
  raw_matches integer;
  raw_players integer;
  season_matches integer;
  too_many integer;
begin
  select count(distinct (p.fingerprint, p.played_at)) into raw_matches from public.participants p;
  if (counts ->> 'matches')::integer <> raw_matches then
    raise exception 'check failed: the function counts % matches and the rows hold %', counts ->> 'matches', raw_matches;
  end if;
  raise notice 'ok: the match total agrees with the raw rows (%)', raw_matches;

  select count(distinct case when p.uid is not null then 'uid:' || p.uid else 'name:' || lower(btrim(p.name)) end)
  into raw_players
  from public.participants p;
  if (counts ->> 'players')::integer <> raw_players then
    raise exception 'check failed: the function counts % players and the rows hold %', counts ->> 'players', raw_players;
  end if;
  raise notice 'ok: the player total agrees with the raw rows (%)', raw_players;

  select coalesce(sum((s ->> 'matches')::integer), 0) into season_matches
  from jsonb_array_elements(counts -> 'half_seasons') s;
  if season_matches <> raw_matches then
    raise exception 'check failed: the half-seasons hold % matches and the total is %', season_matches, raw_matches;
  end if;
  raise notice 'ok: the half-seasons add up to the match total';

  select count(*) into too_many
  from jsonb_array_elements(counts -> 'half_seasons') s
  where (s ->> 'players')::integer > raw_players;
  if too_many <> 0 then
    raise exception 'check failed: % half-seasons count more players than the whole', too_many;
  end if;
  raise notice 'ok: no half-season counts more players than the whole';
end
$$;

rollback;
