-- Checks the verified match history reads: a recorder reads only the matches its own uploads
-- recorded, a scoreboard read returns one player's figures and nothing that names anyone, each is
-- rate limited per recorder, and only the service role can call them.
--
-- Run it against the project after 20261109000000_verified_match_history_reads.sql is applied; it
-- changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/verified_match_history_reads.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  player_a bigint;
  player_b bigint;
  match_a bigint;
  match_b bigint;
  answer jsonb;
  text_answer text;
begin
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'check-uid-a', 'Check Aurora', 'check aurora') returning id into player_a;
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'check-uid-b', 'Check Bram', 'check bram') returning id into player_b;

  insert into public.tracked_matches (player_id, provider, match_uid, played_at, raw_payload, performance, recorded_at)
  values (player_a, 'gep', 'check-match-a', now() - interval '2 hours',
          jsonb_build_object('match_players', jsonb_build_array(
            jsonb_build_object('player_uid', 'check-uid-a', 'nick_name', 'Check Aurora', 'kills', 7, 'deaths', 3, 'assists', 5),
            jsonb_build_object('player_uid', 'check-uid-b', 'nick_name', 'Check Bram', 'kills', 4, 'deaths', 6, 'assists', 9))),
          jsonb_build_object('player_uid', 'check-uid-a', 'kills', 7, 'deaths', 3, 'assists', 5),
          now() - interval '1 hour')
  returning id into match_a;
  insert into public.tracked_matches (player_id, provider, match_uid, played_at, raw_payload, performance)
  values (player_b, 'gep', 'check-match-b', now() - interval '30 minutes', '{}'::jsonb,
          jsonb_build_object('player_uid', 'check-uid-b', 'kills', 11, 'deaths', 1, 'assists', 2))
  returning id into match_b;

  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  values (match_a, 'check-recorder-a'), (match_b, 'check-recorder-b');

  answer := public.read_own_tracked_matches('check-recorder-a', null, 200, 120);
  if answer ->> 'status' <> 'ok'
     or jsonb_array_length(answer -> 'matches') <> 1
     or answer -> 'matches' -> 0 ->> 'matchUid' <> 'check-match-a' then
    raise exception 'own read returned %', answer;
  end if;
  raise notice 'ok: a recorder reads its own upload and not another uploader''s';

  answer := public.read_own_tracked_matches('check-recorder-a', now(), 200, 120);
  if jsonb_array_length(answer -> 'matches') <> 0 then
    raise exception 'own read after now returned %', answer;
  end if;
  raise notice 'ok: only matches written after the given time are returned';

  answer := public.read_own_tracked_matches('check-recorder-nobody', null, 200, 120);
  if jsonb_array_length(answer -> 'matches') <> 0 then
    raise exception 'unknown recorder read returned %', answer;
  end if;
  raise notice 'ok: a recorder with no uploads reads nothing';

  answer := public.read_player_scoreboard_lines('check-recorder-a', 'check-uid-b', 200, 240);
  text_answer := answer::text;
  if answer ->> 'status' <> 'ok'
     or jsonb_array_length(answer -> 'lines') <> 2
     or text_answer like '%Check%' or text_answer like '%check-recorder%' then
    raise exception 'scoreboard read returned %', answer;
  end if;
  if not exists (
    select 1 from jsonb_array_elements(answer -> 'lines') line
    where line ->> 'matchUid' = 'check-match-a' and (line ->> 'kills')::int = 4 and (line ->> 'assists')::int = 9
  ) or not exists (
    select 1 from jsonb_array_elements(answer -> 'lines') line
    where line ->> 'matchUid' = 'check-match-b' and (line ->> 'kills')::int = 11
  ) then
    raise exception 'scoreboard lines were wrong: %', answer;
  end if;
  raise notice 'ok: a scoreboard read returns one player''s figures from every upload, with no names';

  answer := public.read_player_scoreboard_lines('check-recorder-limit', 'check-uid-b', 200, 1);
  answer := public.read_player_scoreboard_lines('check-recorder-limit', 'check-uid-b', 200, 1);
  if answer ->> 'status' <> 'rate_limited' or (answer ->> 'retryAfter')::int < 1 then
    raise exception 'scoreboard limit returned %', answer;
  end if;
  answer := public.read_own_tracked_matches('check-recorder-limit', null, 200, 1);
  answer := public.read_own_tracked_matches('check-recorder-limit', null, 200, 1);
  if answer ->> 'status' <> 'rate_limited' then
    raise exception 'history limit returned %', answer;
  end if;
  raise notice 'ok: both reads are rate limited per recorder, each by its own kind';

  if has_function_privilege('anon', 'public.read_own_tracked_matches(text, timestamptz, integer, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.read_own_tracked_matches(text, timestamptz, integer, integer)', 'execute')
     or has_function_privilege('anon', 'public.read_player_scoreboard_lines(text, text, integer, integer)', 'execute')
     or has_function_privilege('authenticated', 'public.read_player_scoreboard_lines(text, text, integer, integer)', 'execute') then
    raise exception 'an API role can call a verified read directly';
  end if;
  raise notice 'ok: only the service role can call the verified reads';
end
$$;

rollback;
