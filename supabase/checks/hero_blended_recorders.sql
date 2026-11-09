-- Checks the blended hero recorder counts of 20261108170000_hero_blended_recorders.sql (issue 644):
-- every Quick Match and Competitive hero row of a half-season that is not frozen has a count, the two
-- rows of one hero agree, no count is below the row's own mode count, a mode outside the blend has none,
-- and the reader returns the stored count. A frozen half-season may keep a null count.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/hero_blended_recorders.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  uncounted integer;
  disagreeing integer;
  below_mode integer;
  outside_blend integer;
  from_reader integer;
  from_table integer;
begin
  select count(*) into uncounted
  from public.hero_aggregates a
  join public.hero_aggregate_half_seasons h on h.half_season = a.half_season
  where h.frozen_at is null and a.play_mode_id in (0, 1) and a.blended_recorders is null;
  if uncounted <> 0 then
    raise exception 'check failed: % Quick Match or Competitive hero rows of a half-season that is not frozen have no blended recorder count (run select public.recompute_hero_aggregates();)', uncounted;
  end if;
  raise notice 'ok: every blended hero row of a half-season that is not frozen has a blended recorder count';

  select count(*) into disagreeing
  from (
    select a.half_season, a.hero_id
    from public.hero_aggregates a
    where a.play_mode_id in (0, 1)
    group by a.half_season, a.hero_id
    having count(distinct a.blended_recorders) > 1
  ) d;
  if disagreeing <> 0 then
    raise exception 'check failed: % heroes have a different blended count on their Quick Match and Competitive rows', disagreeing;
  end if;
  raise notice 'ok: the two rows of a hero carry the same blended count';

  select count(*) into below_mode
  from public.hero_aggregates a
  where a.blended_recorders is not null and a.recorders is not null and a.blended_recorders < a.recorders;
  if below_mode <> 0 then
    raise exception 'check failed: % hero rows count fewer players in the blend than in their own mode', below_mode;
  end if;
  raise notice 'ok: no blended count is below its row''s own mode count';

  select count(*) into outside_blend
  from public.hero_aggregates a
  where a.play_mode_id not in (0, 1) and a.blended_recorders is not null;
  if outside_blend <> 0 then
    raise exception 'check failed: % hero rows of a mode outside the blend carry a blended count', outside_blend;
  end if;
  raise notice 'ok: no mode outside the blend carries a blended count';

  select count(*) into from_table from public.hero_aggregates where blended_recorders is not null;
  select count(*) into from_reader
  from jsonb_array_elements(public.read_hero_stats() -> 'heroes') e
  where e ->> 'blended_recorders' is not null;
  if from_reader <> from_table then
    raise exception 'check failed: the reader returns % blended counts and the table holds %', from_reader, from_table;
  end if;
  raise notice 'ok: the reader returns every stored blended recorder count (%)', from_table;
end
$$;

rollback;
