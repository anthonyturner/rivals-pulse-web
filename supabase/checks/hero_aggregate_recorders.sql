-- Checks the hero recorder counts of 20261108160000_hero_aggregate_recorders.sql (issue 628): every
-- half-season that is not frozen has a count on every hero row, no count exceeds the hero's matches,
-- and the reader returns the stored count. A frozen half-season may keep a null count.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/hero_aggregate_recorders.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  uncounted integer;
  impossible integer;
  from_reader integer;
  from_table integer;
begin
  select count(*) into uncounted
  from public.hero_aggregates a
  join public.hero_aggregate_half_seasons h on h.half_season = a.half_season
  where h.frozen_at is null and a.recorders is null;
  if uncounted <> 0 then
    raise exception 'check failed: % hero rows of a half-season that is not frozen have no recorder count (run select public.recompute_hero_aggregates();)', uncounted;
  end if;
  raise notice 'ok: every hero row of a half-season that is not frozen has a recorder count';

  select count(*) into impossible
  from public.hero_aggregates a
  where a.recorders is not null and (a.recorders < 1 or a.recorders > a.matches);
  if impossible <> 0 then
    raise exception 'check failed: % hero rows count more recorders than matches, or none', impossible;
  end if;
  raise notice 'ok: no hero row counts more recorders than matches';

  select count(*) into from_table from public.hero_aggregates where recorders is not null;
  select count(*) into from_reader
  from jsonb_array_elements(public.read_hero_stats() -> 'heroes') e
  where e ->> 'recorders' is not null;
  if from_reader <> from_table then
    raise exception 'check failed: the reader returns % counts and the table holds %', from_reader, from_table;
  end if;
  raise notice 'ok: the reader returns every stored recorder count (%)', from_table;
end
$$;

rollback;
