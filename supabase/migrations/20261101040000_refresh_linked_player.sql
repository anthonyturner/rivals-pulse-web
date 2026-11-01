-- Lets the desktop app refresh the name and avatar of the player it is linked to.
-- Additive: it builds on the tables of 20261101020000_player_links.sql and touches no object the
-- overlay calls. Every function here is for the service role only; the `refresh-linked-player` Edge
-- Function calls it after confirming the Overwolf session, so `p_recorder_id` is the verified
-- recorder, never a value the app chose.

-- The attempt log gains a kind for the app's own calls. One kind per function (`refresh` here), so
-- each is counted against its own limit.
alter table public.link_attempt_log drop constraint if exists link_attempt_log_kind_check;
alter table public.link_attempt_log
  add constraint link_attempt_log_kind_check check (kind in ('issue', 'redeem_failed', 'refresh'));

-- Counts one call by the app against a per-recorder limit over link_issue_window(), the same window
-- and approach as issue_link_code. Returns 0 when the call is allowed (and records it), else the
-- seconds until the oldest counted call falls out of the window. The advisory lock makes
-- count-then-insert exact; a refused call is not recorded, so asking again cannot extend the wait.
create or replace function public.take_link_app_call(
  p_kind text,
  p_recorder_id text,
  p_limit integer
) returns integer
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  oldest timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_recorder_id, 0));

  delete from public.link_attempt_log where kind = p_kind and attempted_at < now() - public.link_issue_window();

  select count(*), min(attempted_at) into used, oldest
  from public.link_attempt_log
  where kind = p_kind and subject = p_recorder_id and attempted_at > now() - public.link_issue_window();

  if used >= p_limit then
    return greatest(1, ceil(extract(epoch from (oldest + public.link_issue_window() - now())))::integer);
  end if;

  insert into public.link_attempt_log (kind, subject) values (p_kind, p_recorder_id);
  return 0;
end
$$;

-- Updates the name and avatar of the link held by p_recorder_id. Returns {"status":"refreshed"},
-- {"status":"not_linked"} (nothing is written or created) or {"status":"rate_limited","retryAfter":
-- seconds}. Only player_name and avatar_url are set: player_uid and user_id never change here, so
-- switching to another game account means linking again.
create or replace function public.refresh_linked_player(
  p_recorder_id text,
  p_player_name text,
  p_avatar_url text,
  p_limit integer
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wait integer := public.take_link_app_call('refresh', p_recorder_id, p_limit);
begin
  if wait > 0 then
    return jsonb_build_object('status', 'rate_limited', 'retryAfter', wait);
  end if;

  -- The same lock redeem_link_code takes, so a refresh never lands halfway through a re-link.
  perform pg_advisory_xact_lock(hashtextextended('recorder:' || p_recorder_id, 0));

  update public.player_links
  set player_name = p_player_name, avatar_url = p_avatar_url
  where recorder_id = p_recorder_id;

  if not found then
    return jsonb_build_object('status', 'not_linked');
  end if;
  return jsonb_build_object('status', 'refreshed');
end
$$;

-- Same purge as before, but it now ages out every kind of the app's own calls by the hour window
-- instead of naming 'issue' alone, so a later kind needs no change here.
create or replace function public.purge_link_data()
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.link_attempt_log
  where (kind <> 'redeem_failed' and attempted_at < now() - public.link_issue_window())
     or (kind = 'redeem_failed' and attempted_at < now() - public.link_lockout_window());

  delete from public.link_codes where expires_at < now();
end
$$;

revoke execute on function public.take_link_app_call(text, text, integer) from public, anon, authenticated;
revoke execute on function public.refresh_linked_player(text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.purge_link_data() from public, anon, authenticated;
grant execute on function public.take_link_app_call(text, text, integer) to service_role;
grant execute on function public.refresh_linked_player(text, text, text, integer) to service_role;
grant execute on function public.purge_link_data() to service_role;
