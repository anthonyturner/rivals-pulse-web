-- Issue 189: the desktop app reads its match history through an Overwolf-verified Edge Function
-- instead of selecting `tracked_matches` with the publishable key.
--
-- Additive only. `players`, `player_matches` and `tracked_matches` stay readable by `anon` here,
-- because every shipped overlay still reads them directly; the grant is dropped in a later migration
-- once the overlays in use call `read-match-history` and `read-player-scoreboard` instead.
--
-- Both functions are for the service role only and are keyed on the recorder (the HMAC of the
-- verified Overwolf username), never on a name or uid the caller merely claims.

alter table public.link_attempt_log drop constraint if exists link_attempt_log_kind_check;
alter table public.link_attempt_log
  add constraint link_attempt_log_kind_check
  check (kind in ('issue', 'redeem_failed', 'refresh', 'status', 'unlink', 'history', 'scoreboard'));

-- A recorder's own uploads, newest written first.
create index if not exists tracked_match_recorders_recorded_by_idx
  on public.tracked_match_recorders (recorded_by, recorded_at desc);

-- The matches p_recorder_id uploaded and Supabase wrote after p_after (all of them when null),
-- newest written first, at most p_max (capped at 500). Returns {"status":"ok","matches":[{matchUid,
-- playedAt, recordedAt, rawPayload, performance}]} or {"status":"rate_limited","retryAfter":seconds}.
-- Matches uploaded before track-match-history recorded its recorder (issue 328) have no recorder row
-- and are not returned; the app already holds them in its local history.
create or replace function public.read_own_tracked_matches(
  p_recorder_id text,
  p_after timestamptz,
  p_max integer,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := public.take_link_app_call('history', p_recorder_id, p_limit);
  answer_rows jsonb;
begin
  if wait > 0 then
    return jsonb_build_object('status', 'rate_limited', 'retryAfter', wait);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'matchUid', own.match_uid,
           'playedAt', own.played_at,
           'recordedAt', own.recorded_at,
           'rawPayload', own.raw_payload,
           'performance', own.performance
         ) order by own.recorded_at desc), '[]'::jsonb)
    into answer_rows
  from (
    select tm.match_uid, tm.played_at, tm.recorded_at, tm.raw_payload, tm.performance
    from public.tracked_match_recorders r
    join public.tracked_matches tm on tm.id = r.tracked_match_id
    where r.recorded_by = p_recorder_id
      and (p_after is null or tm.recorded_at > p_after)
    order by tm.recorded_at desc
    limit least(greatest(coalesce(p_max, 0), 0), 500)
  ) own;

  return jsonb_build_object('status', 'ok', 'matches', answer_rows);
end
$$;

-- One player's kills, deaths and assists in each uploaded match they played, newest played first,
-- at most p_max (capped at 500): from the uploader's own line, and from any upload's scoreboard that
-- lists p_player_uid (as text, or as the same safe integer an older upload stored). Returns
-- {"status":"ok","lines":[{matchUid, kills, deaths, assists}]} or {"status":"rate_limited",...}.
-- Nothing else leaves: no names, no other player's line, no uploader.
create or replace function public.read_player_scoreboard_lines(
  p_recorder_id text,
  p_player_uid text,
  p_max integer,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := public.take_link_app_call('scoreboard', p_recorder_id, p_limit);
  uid text := btrim(coalesce(p_player_uid, ''));
  numeric_uid jsonb;
  cap integer := least(greatest(coalesce(p_max, 0), 0), 500);
  answer_rows jsonb;
begin
  if wait > 0 then
    return jsonb_build_object('status', 'rate_limited', 'retryAfter', wait);
  end if;
  if uid = '' then
    return jsonb_build_object('status', 'ok', 'lines', '[]'::jsonb);
  end if;
  -- An older upload may store the uid as a number; never coerce a zero-prefixed or unsafe integer.
  -- Nested, because SQL does not promise to test the pattern before the cast.
  if uid ~ '^(0|[1-9][0-9]{0,15})$' then
    if uid::bigint <= 9007199254740991 then
      numeric_uid := to_jsonb(uid::bigint);
    end if;
  end if;

  with own_lines as (
    select tm.match_uid, tm.played_at, tm.performance as line, 0 as source
    from public.tracked_matches tm
    where tm.provider = 'gep' and tm.performance ->> 'player_uid' = uid
    order by tm.played_at desc nulls last
    limit cap
  ), listed as (
    select tm.match_uid, tm.played_at, entry as line, 1 as source
    from public.tracked_matches tm
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(tm.raw_payload -> 'match_players') = 'array'
           then tm.raw_payload -> 'match_players' else '[]'::jsonb end
    ) entry
    where tm.provider = 'gep'
      and (tm.raw_payload @> jsonb_build_object('match_players', jsonb_build_array(jsonb_build_object('player_uid', uid)))
        or (numeric_uid is not null
            and tm.raw_payload @> jsonb_build_object('match_players', jsonb_build_array(jsonb_build_object('player_uid', numeric_uid)))))
      and (entry -> 'player_uid' = to_jsonb(uid) or (numeric_uid is not null and entry -> 'player_uid' = numeric_uid))
  ), best as (
    select distinct on (match_uid) match_uid, played_at, line
    from (select * from own_lines union all select * from listed) every_line
    order by match_uid, source, played_at desc nulls last
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'matchUid', picked.match_uid,
           'kills', picked.line -> 'kills',
           'deaths', picked.line -> 'deaths',
           'assists', picked.line -> 'assists'
         ) order by picked.played_at desc nulls last), '[]'::jsonb)
    into answer_rows
  from (select * from best order by played_at desc nulls last limit cap) picked;

  return jsonb_build_object('status', 'ok', 'lines', answer_rows);
end
$$;

revoke execute on function public.read_own_tracked_matches(text, timestamptz, integer, integer) from public, anon, authenticated;
revoke execute on function public.read_player_scoreboard_lines(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.read_own_tracked_matches(text, timestamptz, integer, integer) to service_role;
grant execute on function public.read_player_scoreboard_lines(text, text, integer, integer) to service_role;
