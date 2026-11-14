-- Checks the backfill of recorder rows for matches uploaded before `tracked_match_recorders` existed
-- (issue 697): a match is tied only to the one recorder its player's recorded matches name, never
-- when two recorders are named, none is, or the match's own uid contradicts them; an existing
-- recorder is never replaced; and `read_own_tracked_matches` returns what was tied.
--
-- Run it against the project after 20261109100000_backfill_tracked_match_recorders.sql is applied; it
-- changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/backfill_tracked_match_recorders.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  player_a bigint;
  player_b bigint;
  player_c bigint;
  answer jsonb;
  tied integer;
  recorder_of text;
begin
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'check-backfill-a', 'Check Backfill A', 'check backfill a') returning id into player_a;
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'check-backfill-b', 'Check Backfill B', 'check backfill b') returning id into player_b;
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'check-backfill-c', 'Check Backfill C', 'check backfill c') returning id into player_c;

  insert into public.tracked_matches (player_id, provider, match_uid, played_at, performance, recorded_at) values
    (player_a, 'gep', 'check-backfill-a-recorded', now() - interval '5 days', '{"player_uid":"check-uid-1"}', now() - interval '5 days'),
    (player_a, 'gep', 'check-backfill-a-same-uid', now() - interval '4 days', '{"player_uid":"check-uid-1"}', now() - interval '4 days'),
    (player_a, 'gep', 'check-backfill-a-no-uid', now() - interval '3 days', '{"kills":1,"deaths":2,"assists":3}', now() - interval '3 days'),
    (player_a, 'gep', 'check-backfill-a-no-performance', now() - interval '3 days', null, now() - interval '3 days'),
    (player_a, 'gep', 'check-backfill-a-other-uid', now() - interval '2 days', '{"player_uid":"check-uid-2"}', now() - interval '2 days'),
    (player_b, 'gep', 'check-backfill-b-recorded-1', now() - interval '3 days', '{"player_uid":"check-uid-3"}', now() - interval '3 days'),
    (player_b, 'gep', 'check-backfill-b-recorded-2', now() - interval '2 days', '{"player_uid":"check-uid-3"}', now() - interval '2 days'),
    (player_b, 'gep', 'check-backfill-b-old', now() - interval '1 day', '{"player_uid":"check-uid-3"}', now() - interval '1 day'),
    (player_c, 'gep', 'check-backfill-c-old', now() - interval '1 day', '{"player_uid":"check-uid-4"}', now() - interval '1 day');

  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  select id, 'check-backfill-recorder-1' from public.tracked_matches where match_uid = 'check-backfill-a-recorded';
  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  select id, 'check-backfill-recorder-1' from public.tracked_matches where match_uid = 'check-backfill-b-recorded-1';
  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  select id, 'check-backfill-recorder-2' from public.tracked_matches where match_uid = 'check-backfill-b-recorded-2';

  tied := public.backfill_tracked_match_recorders();
  if tied < 3 then
    raise exception 'backfill tied % matches, expected at least the three of player A', tied;
  end if;

  select jsonb_agg(m.match_uid order by m.match_uid) into answer
  from public.tracked_match_recorders r
  join public.tracked_matches m on m.id = r.tracked_match_id
  where r.recorded_by = 'check-backfill-recorder-1' and m.match_uid like 'check-backfill-a-%';
  if answer is distinct from '["check-backfill-a-no-performance","check-backfill-a-no-uid","check-backfill-a-recorded","check-backfill-a-same-uid"]'::jsonb then
    raise exception 'player A was tied as %', answer;
  end if;
  raise notice 'ok: matches of a player with one recorder are tied to it, with or without a uid of their own';

  if exists (
    select 1 from public.tracked_match_recorders r
    join public.tracked_matches m on m.id = r.tracked_match_id
    where m.match_uid = 'check-backfill-a-other-uid'
  ) then
    raise exception 'a match whose uid contradicts the recorded ones was tied';
  end if;
  raise notice 'ok: a match with another uid than the recorded ones stays untied';

  if exists (
    select 1 from public.tracked_match_recorders r
    join public.tracked_matches m on m.id = r.tracked_match_id
    where m.match_uid = 'check-backfill-b-old'
  ) then
    raise exception 'a match of a player with two recorders was tied';
  end if;
  raise notice 'ok: a player whose recorded matches name two recorders stays untied';

  if exists (
    select 1 from public.tracked_match_recorders r
    join public.tracked_matches m on m.id = r.tracked_match_id
    where m.match_uid = 'check-backfill-c-old'
  ) then
    raise exception 'a match of a player with no recorded match was tied';
  end if;
  raise notice 'ok: a player with no recorded match has no evidence and stays untied';

  select r.recorded_by into recorder_of
  from public.tracked_match_recorders r
  join public.tracked_matches m on m.id = r.tracked_match_id
  where m.match_uid = 'check-backfill-b-recorded-2';
  if recorder_of <> 'check-backfill-recorder-2' then
    raise exception 'an existing recorder was replaced by %', recorder_of;
  end if;
  raise notice 'ok: a recorder already stored is never replaced';

  if exists (
    select 1 from public.tracked_match_recorders r
    join public.tracked_matches m on m.id = r.tracked_match_id
    where m.match_uid = 'check-backfill-a-same-uid' and r.recorded_at <> m.recorded_at
  ) then
    raise exception 'a tied row did not keep the time its match was written';
  end if;
  raise notice 'ok: a tied row keeps the time its match was written';

  if public.backfill_tracked_match_recorders() <> 0 then
    raise exception 'a second run tied more matches';
  end if;
  raise notice 'ok: running it again ties nothing more';

  answer := public.read_own_tracked_matches('check-backfill-recorder-1', null, 200, 120);
  if answer ->> 'status' <> 'ok'
     or (select count(*) from jsonb_array_elements(answer -> 'matches') m where m ->> 'matchUid' like 'check-backfill-a-%') <> 4 then
    raise exception 'the read returned %', answer;
  end if;
  raise notice 'ok: the recorder reads its older matches through read_own_tracked_matches';
end
$$;

rollback;
