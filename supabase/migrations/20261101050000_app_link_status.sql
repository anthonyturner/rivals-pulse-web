-- Lets the desktop app see and remove its website link. Additive: it builds on
-- 20261101020000_player_links.sql and 20261101040000_refresh_linked_player.sql and touches no object
-- the overlay calls. Both functions are for the service role only; the `link-status` and
-- `unlink-player-app` Edge Functions call them after confirming the Overwolf session, so
-- `p_recorder_id` is the verified recorder, never a value the app chose.
--
-- The website unlinks with `unlink_player()`, keyed on `auth.uid()`. The app has no website session,
-- so these are keyed on the recorder instead. Neither returns the website account's id or email.

-- One log kind per function, so each is counted against its own limit.
alter table public.link_attempt_log drop constraint if exists link_attempt_log_kind_check;
alter table public.link_attempt_log
  add constraint link_attempt_log_kind_check
  check (kind in ('issue', 'redeem_failed', 'refresh', 'status', 'unlink'));

-- Whether p_recorder_id is linked, and to whom by name. Returns {"status":"linked","playerName":...,
-- "linkedAt":...}, {"status":"not_linked"} or {"status":"rate_limited","retryAfter":seconds}. It
-- reads player_name and linked_at and no other column, so the account behind the link cannot leak.
create or replace function public.link_status_for_recorder(
  p_recorder_id text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := public.take_link_app_call('status', p_recorder_id, p_limit);
  found_name text;
  found_at timestamptz;
begin
  if wait > 0 then
    return jsonb_build_object('status', 'rate_limited', 'retryAfter', wait);
  end if;

  select player_name, linked_at into found_name, found_at
  from public.player_links
  where recorder_id = p_recorder_id;

  if not found then
    return jsonb_build_object('status', 'not_linked');
  end if;
  return jsonb_build_object('status', 'linked', 'playerName', found_name, 'linkedAt', found_at);
end
$$;

-- Removes the link held by p_recorder_id. Returns {"status":"unlinked"}, {"status":"not_linked"}
-- (nothing to remove) or {"status":"rate_limited","retryAfter":seconds}. Afterwards the website
-- reads "not linked" for that account, exactly as after unlink_player(). A code the recorder has
-- issued and not yet used is deleted too, so it cannot be typed after the player chose to unlink.
create or replace function public.unlink_player_for_recorder(
  p_recorder_id text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := public.take_link_app_call('unlink', p_recorder_id, p_limit);
begin
  if wait > 0 then
    return jsonb_build_object('status', 'rate_limited', 'retryAfter', wait);
  end if;

  -- The same lock redeem_link_code takes, so an unlink never lands halfway through a re-link.
  perform pg_advisory_xact_lock(hashtextextended('recorder:' || p_recorder_id, 0));

  delete from public.link_codes where recorder_id = p_recorder_id;
  delete from public.player_links where recorder_id = p_recorder_id;

  if not found then
    return jsonb_build_object('status', 'not_linked');
  end if;
  return jsonb_build_object('status', 'unlinked');
end
$$;

revoke execute on function public.link_status_for_recorder(text, integer) from public, anon, authenticated;
revoke execute on function public.unlink_player_for_recorder(text, integer) from public, anon, authenticated;
grant execute on function public.link_status_for_recorder(text, integer) to service_role;
grant execute on function public.unlink_player_for_recorder(text, integer) to service_role;
