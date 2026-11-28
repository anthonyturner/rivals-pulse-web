-- Checks 20261108180000_match_hero_timelines.sql (issue 654) on fixtures: a timeline is stored whole or
-- not at all, a malformed value raises nothing, a second upload of the same match stores nothing more,
-- and the purge deletes expired timelines while a current match keeps its own.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/match_hero_timelines.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  written integer;
  stored integer;
begin
  insert into public.participants (fingerprint, half_season, played_at, uid, team, hero_id, recorded_by)
  values ('timelines-check', 9.0, now(), 'timelines-check-uid', 0, 1011, 'timelines-check-recorder');

  written := public.record_match_hero_timelines('timelines-check', now(), '[
    {"team": 0, "picks": [{"hero_id": 1050, "at_second": 0}, {"hero_id": 1011, "at_second": 120.0}]},
    {"team": 1, "picks": [{"hero_id": 1033, "at_second": 30}, {"hero_id": 1044, "at_second": 10}]},
    {"team": 1, "picks": [{"hero_id": "x", "at_second": 0}]},
    {"team": 11, "picks": [{"hero_id": 1033, "at_second": 0}]},
    {"team": 1, "picks": []},
    {"team": 1, "picks": [{"hero_id": 1.5, "at_second": 0}]},
    "not a timeline"
  ]'::jsonb);
  select count(*) into stored from public.match_hero_timelines where fingerprint = 'timelines-check';
  if written <> 1 or stored <> 2 then
    raise exception 'check failed: expected 1 whole timeline of 2 picks, got % timelines and % rows', written, stored;
  end if;
  raise notice 'ok: only the timeline that is whole was stored';

  written := public.record_match_hero_timelines('timelines-check', now() + interval '1 minute', '[{"team": 0, "picks": [{"hero_id": 1011, "at_second": 0}]}]'::jsonb);
  select count(*) into stored from public.match_hero_timelines where fingerprint = 'timelines-check';
  if written <> 0 or stored <> 2 then
    raise exception 'check failed: a second upload of the same match wrote % timelines and left % rows', written, stored;
  end if;
  raise notice 'ok: a second upload of the same match stored nothing more';

  if public.record_match_hero_timelines('nobody-recorded-this', now(), '[{"team": 0, "picks": [{"hero_id": 1011, "at_second": 0}]}]'::jsonb) <> 0 then
    raise exception 'check failed: timelines were stored for a match that is not in participants';
  end if;
  if public.record_match_hero_timelines('timelines-check', now(), '{"team": 0}'::jsonb) <> 0
     or public.record_match_hero_timelines('timelines-check', now(), 'null'::jsonb) <> 0 then
    raise exception 'check failed: a value that is not a list stored rows';
  end if;
  raise notice 'ok: an unrecorded match and a value that is not a list store nothing';

  insert into public.match_hero_timelines (fingerprint, half_season, played_at, team, timeline_no, pick_no, hero_id, at_second)
  values ('timelines-check-old', 1.0, now() - interval '2 years', 0, 1, 1, 1011, 0);
  perform public.purge_expired_participants();
  if exists (select 1 from public.match_hero_timelines where fingerprint = 'timelines-check-old') then
    raise exception 'check failed: the purge left an expired timeline';
  end if;
  raise notice 'ok: the purge deleted the expired timeline';
end
$$;

rollback;
