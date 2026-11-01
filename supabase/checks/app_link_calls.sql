-- Checks the calls the desktop app makes about its own link: a refresh changes the name
-- and avatar of the verified recorder's link and nothing else, never creates a link, is rate limited
-- per recorder, and is reachable only by the service role.
--
-- Run it against the project after 20261101040000_refresh_linked_player.sql is applied; it changes
-- nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/app_link_calls.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  answer jsonb;
  seen integer;
  before_link public.player_links%rowtype;
  after_link public.player_links%rowtype;
begin
  insert into auth.users (id, email)
  values
    (account_a, 'app-calls-check-a@example.invalid'),
    (account_b, 'app-calls-check-b@example.invalid');

  insert into public.player_links (user_id, recorder_id, player_uid, player_name, avatar_url, linked_at)
  values
    (account_a, 'check-app-recorder-a', 'uid-a', 'Aurora', 'https://content.overwolf.com/old.png', now() - interval '3 days'),
    (account_b, 'check-app-recorder-b', 'uid-b', 'Bram', null, now() - interval '2 days');

  select * into before_link from public.player_links where user_id = account_a;

  -- A refresh sets the name and avatar of the recorder's own link.
  set local role service_role;
  answer := public.refresh_linked_player('check-app-recorder-a', 'Aurora Prime', 'https://content.overwolf.com/new.png', 30);
  reset role;
  if answer ->> 'status' <> 'refreshed' then
    raise exception 'check failed: a linked recorder was not refreshed (%)', answer;
  end if;

  select * into after_link from public.player_links where user_id = account_a;
  if after_link.player_name <> 'Aurora Prime' or after_link.avatar_url <> 'https://content.overwolf.com/new.png' then
    raise exception 'check failed: the name or avatar was not updated (%, %)', after_link.player_name, after_link.avatar_url;
  end if;
  raise notice 'ok: a refresh updates the name and avatar';

  -- Nothing else about the link moves: not the uid, the account, the recorder or the link date.
  if after_link.player_uid <> before_link.player_uid
     or after_link.user_id <> before_link.user_id
     or after_link.recorder_id <> before_link.recorder_id
     or after_link.linked_at <> before_link.linked_at then
    raise exception 'check failed: a refresh changed more than the name and avatar';
  end if;
  raise notice 'ok: a refresh never changes the uid, the account, the recorder or the link date';

  -- An avatar of none clears it, so a player who removes their picture is not shown a stale one.
  set local role service_role;
  answer := public.refresh_linked_player('check-app-recorder-a', 'Aurora Prime', null, 30);
  reset role;
  select * into after_link from public.player_links where user_id = account_a;
  if after_link.avatar_url is not null then
    raise exception 'check failed: a refresh with no avatar kept the old one';
  end if;
  raise notice 'ok: a refresh with no avatar clears it';

  -- Only the recorder's own link moves.
  if (select player_name from public.player_links where user_id = account_b) <> 'Bram' then
    raise exception 'check failed: a refresh changed another recorder''s link';
  end if;
  raise notice 'ok: a refresh leaves other links alone';

  -- A recorder with no link gets a no-op answer and nothing is created.
  select count(*) into seen from public.player_links;
  set local role service_role;
  answer := public.refresh_linked_player('check-app-unlinked', 'Nobody', 'https://content.overwolf.com/x.png', 30);
  reset role;
  if answer ->> 'status' <> 'not_linked' then
    raise exception 'check failed: an unlinked recorder was not told so (%)', answer;
  end if;
  if (select count(*) from public.player_links) <> seen then
    raise exception 'check failed: a refresh created a link';
  end if;
  raise notice 'ok: a refresh without a link is a no-op and creates nothing';

  -- The table still refuses an avatar that is not https, whoever sends it.
  begin
    set local role service_role;
    perform public.refresh_linked_player('check-app-recorder-b', 'Bram', 'http://content.overwolf.com/a.png', 30);
    raise exception 'check failed: a non-https avatar was stored';
  exception when check_violation then
    raise notice 'ok: a non-https avatar is refused by the table';
  end;
  reset role;

  -- The limit is per recorder: three calls are allowed, the fourth is told when to come back, and a
  -- refused call is not counted, so asking again cannot lengthen the wait. Recorder A has already
  -- used two calls above.
  set local role service_role;
  answer := public.refresh_linked_player('check-app-recorder-a', 'Aurora Prime', null, 3);
  if answer ->> 'status' <> 'refreshed' then
    raise exception 'check failed: the call inside the limit was refused (%)', answer;
  end if;
  answer := public.refresh_linked_player('check-app-recorder-a', 'Over Limit', null, 3);
  reset role;
  if answer ->> 'status' <> 'rate_limited'
     or (answer ->> 'retryAfter')::integer not between 1 and 3600 then
    raise exception 'check failed: the call past the limit was not rate limited (%)', answer;
  end if;
  if (select player_name from public.player_links where user_id = account_a) <> 'Aurora Prime' then
    raise exception 'check failed: a rate limited call still changed the link';
  end if;
  select count(*) into seen from public.link_attempt_log where kind = 'refresh' and subject = 'check-app-recorder-a';
  if seen <> 3 then
    raise exception 'check failed: % refresh rows are logged, expected 3 (a refused call must not count)', seen;
  end if;
  raise notice 'ok: refreshes are rate limited per recorder and a refused call is not counted';

  set local role service_role;
  answer := public.refresh_linked_player('check-app-recorder-b', 'Bram', null, 3);
  reset role;
  if answer ->> 'status' <> 'refreshed' then
    raise exception 'check failed: one recorder''s limit stopped another recorder (%)', answer;
  end if;
  raise notice 'ok: one recorder''s limit does not stop another';

  -- The call ages out of the window (backdated; no waiting) and the purge sweeps old refresh rows.
  update public.link_attempt_log set attempted_at = now() - interval '61 minutes'
  where kind = 'refresh' and subject = 'check-app-recorder-a';
  set local role service_role;
  answer := public.refresh_linked_player('check-app-recorder-a', 'Aurora Prime', null, 3);
  reset role;
  if answer ->> 'status' <> 'refreshed' then
    raise exception 'check failed: the limit did not lift with the window (%)', answer;
  end if;
  raise notice 'ok: the limit lifts with the window';

  insert into public.link_attempt_log (kind, subject, attempted_at)
  values ('refresh', 'check-app-old', now() - interval '61 minutes'),
         ('refresh', 'check-app-new', now() - interval '59 minutes');
  set local role service_role;
  perform public.purge_link_data();
  reset role;
  select count(*) into seen from public.link_attempt_log where subject = 'check-app-old';
  if seen <> 0 then
    raise exception 'check failed: the purge kept a refresh row past its window';
  end if;
  select count(*) into seen from public.link_attempt_log where subject = 'check-app-new';
  if seen <> 1 then
    raise exception 'check failed: the purge deleted a refresh row still inside its window';
  end if;
  raise notice 'ok: the purge sweeps refresh rows past the hour and keeps the rest';

  -- Only the service role may call these.
  begin
    set local role authenticated;
    perform public.refresh_linked_player('check-app-recorder-a', 'Hijack', null, 30);
    raise exception 'check failed: a signed-in client can refresh a link';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in client cannot refresh a link';
  end;
  reset role;

  begin
    set local role anon;
    perform public.refresh_linked_player('check-app-recorder-a', 'Hijack', null, 30);
    raise exception 'check failed: an anonymous client can refresh a link';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous client cannot refresh a link';
  end;
  reset role;

  begin
    set local role authenticated;
    perform public.take_link_app_call('refresh', 'check-app-recorder-a', 30);
    raise exception 'check failed: a client can write the app call log';
  exception when insufficient_privilege then
    raise notice 'ok: a client cannot write the app call log';
  end;
  reset role;

  if (select player_name from public.player_links where user_id = account_a) <> 'Aurora Prime' then
    raise exception 'check failed: a client changed the link';
  end if;
end
$$;

rollback;
