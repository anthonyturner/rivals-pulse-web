-- Checks the rules of linking a website account to an in-game player (issue 264): codes expire and
-- work once, a new code cancels the old, a wrong code is one answer and is rate limited, the latest
-- proof wins, an account reads only its own link, and a client cannot write the tables directly.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/player_links.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  account_c uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  claims_c text;
  answer jsonb;
  seen integer;
  seen_name text;
begin
  insert into auth.users (id, email)
  values
    (account_a, 'links-check-a@example.invalid'),
    (account_b, 'links-check-b@example.invalid'),
    (account_c, 'links-check-c@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;
  claims_c := json_build_object('sub', account_c, 'role', 'authenticated')::text;

  -- Issuing: the code is stored as a hash, never as itself.
  answer := public.issue_link_code('check-recorder-a', 'ABCDEFGH', 'uid-a', 'Aurora',
    'https://content.overwolf.com/a.png', interval '10 minutes', 5, interval '1 hour');
  if answer ->> 'status' <> 'issued' then
    raise exception 'check failed: a first code was not issued (%)', answer;
  end if;

  select count(*) into seen from public.link_codes
  where recorder_id = 'check-recorder-a' and code_hash = public.link_code_hash('ABCDEFGH');
  if seen <> 1 then
    raise exception 'check failed: the issued code was not stored as its hash';
  end if;

  select count(*) into seen from public.link_codes
  where to_jsonb(link_codes)::text like '%ABCDEFGH%';
  if seen <> 0 then
    raise exception 'check failed: the code itself was stored';
  end if;
  raise notice 'ok: a code is stored as its hash only';

  -- A new code cancels the old one.
  answer := public.issue_link_code('check-recorder-a', 'JKMNPQRS', 'uid-a', 'Aurora',
    'https://content.overwolf.com/a.png', interval '10 minutes', 5, interval '1 hour');

  select count(*) into seen from public.link_codes where recorder_id = 'check-recorder-a';
  if seen <> 1 then
    raise exception 'check failed: a recorder holds % codes, not one', seen;
  end if;

  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;

  answer := public.redeem_link_code('ABCDEFGH');
  if answer ->> 'status' <> 'invalid' then
    raise exception 'check failed: a cancelled code was accepted (%)', answer;
  end if;
  raise notice 'ok: issuing a new code cancels the old one';

  -- Redeeming links the account and uses the code up.
  answer := public.redeem_link_code('JKMNPQRS');
  if answer ->> 'status' <> 'linked' or answer ->> 'name' <> 'Aurora' then
    raise exception 'check failed: a valid code did not link (%)', answer;
  end if;

  select count(*) into seen from public.player_links where user_id = account_a;
  if seen <> 1 then
    raise exception 'check failed: account A cannot read its own link';
  end if;
  raise notice 'ok: a valid code links the account, and the account reads its link';

  reset role;
  select count(*) into seen from public.link_codes where recorder_id = 'check-recorder-a';
  if seen <> 0 then
    raise exception 'check failed: a used code was kept';
  end if;

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  answer := public.redeem_link_code('JKMNPQRS');
  if answer ->> 'status' <> 'invalid' then
    raise exception 'check failed: a used code was accepted a second time (%)', answer;
  end if;
  raise notice 'ok: a code works once';

  -- An expired code is refused (the row is backdated; no waiting).
  reset role;
  perform public.issue_link_code('check-recorder-b', 'MNPQRSTV', 'uid-b', 'Borealis', null,
    interval '10 minutes', 5, interval '1 hour');
  update public.link_codes set expires_at = now() - interval '1 second' where recorder_id = 'check-recorder-b';

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  answer := public.redeem_link_code('MNPQRSTV');
  if answer ->> 'status' <> 'invalid' then
    raise exception 'check failed: an expired code was accepted (%)', answer;
  end if;

  select count(*) into seen from public.player_links where user_id = account_b;
  if seen <> 0 then
    raise exception 'check failed: a refused code linked account B';
  end if;
  raise notice 'ok: an expired code is refused and links nothing';

  -- A wrong, a used and an expired code are the same answer.
  if public.redeem_link_code('ZZZZZZZZ') <> jsonb_build_object('status', 'invalid') then
    raise exception 'check failed: a wrong code is told apart from a used one';
  end if;
  raise notice 'ok: wrong, used and expired codes get one answer';

  -- Five wrong codes in 15 minutes lock the account out, even for a right code.
  reset role;
  perform public.issue_link_code('check-recorder-c', 'QRSTVWXY', 'uid-c', 'Corona', null,
    interval '10 minutes', 5, interval '1 hour');

  perform set_config('request.jwt.claims', claims_c, true);
  set local role authenticated;

  for attempt in 1..5 loop
    answer := public.redeem_link_code('00000000');
    if answer ->> 'status' <> 'invalid' then
      raise exception 'check failed: wrong code % was not refused as invalid (%)', attempt, answer;
    end if;
  end loop;

  answer := public.redeem_link_code('QRSTVWXY');
  if answer ->> 'status' <> 'rate_limited' or (answer ->> 'retryAfter')::integer <= 0 then
    raise exception 'check failed: five failures did not lock the account out (%)', answer;
  end if;

  select count(*) into seen from public.player_links where user_id = account_c;
  if seen <> 0 then
    raise exception 'check failed: a rate limited account was linked';
  end if;
  raise notice 'ok: five wrong codes in 15 minutes lock the account out';

  -- The lock ends with the window (the failures are backdated).
  reset role;
  update public.link_attempt_log set attempted_at = now() - interval '16 minutes'
  where kind = 'redeem_failed' and subject = account_c::text;

  perform set_config('request.jwt.claims', claims_c, true);
  set local role authenticated;

  answer := public.redeem_link_code('QRSTVWXY');
  if answer ->> 'status' <> 'linked' then
    raise exception 'check failed: the lock did not end after 15 minutes (%)', answer;
  end if;
  raise notice 'ok: the lock ends after 15 minutes';

  -- Latest proof wins: a fresh code for recorder A, redeemed by account B, moves the link.
  reset role;
  perform public.issue_link_code('check-recorder-a', 'ABCDEFGH', 'uid-a', 'Aurora', null,
    interval '10 minutes', 5, interval '1 hour');

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  answer := public.redeem_link_code('ABCDEFGH');
  if answer ->> 'status' <> 'linked' then
    raise exception 'check failed: the moved link was refused (%)', answer;
  end if;

  select player_name into seen_name from public.player_links where user_id = account_b;
  if seen_name is distinct from 'Aurora' then
    raise exception 'check failed: account B does not hold the moved link';
  end if;

  perform set_config('request.jwt.claims', claims_a, true);

  select count(*) into seen from public.player_links;
  if seen <> 0 then
    raise exception 'check failed: account A still reads a link after it moved';
  end if;
  raise notice 'ok: the latest proof wins and the old account shows as unlinked';

  -- An account holds at most one link: redeeming another player replaces its first.
  reset role;
  perform public.issue_link_code('check-recorder-d', 'TVWXYZ01', 'uid-d', 'Dawn', null,
    interval '10 minutes', 5, interval '1 hour');

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  answer := public.redeem_link_code('TVWXYZ01');
  select count(*), min(player_name) into seen, seen_name from public.player_links;
  if answer ->> 'status' <> 'linked' or seen <> 1 or seen_name <> 'Dawn' then
    raise exception 'check failed: an account holds % links, the first being %', seen, seen_name;
  end if;
  raise notice 'ok: an account has at most one link';

  -- Only the owner reads a link.
  perform set_config('request.jwt.claims', claims_a, true);

  select count(*) into seen from public.player_links where user_id = account_b;
  if seen <> 0 then
    raise exception 'check failed: account A can read account B''s link';
  end if;
  raise notice 'ok: an account cannot read another account''s link';

  reset role;
  set local role anon;

  begin
    perform 1 from public.player_links limit 1;
    raise exception 'check failed: an anonymous caller can read links';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous caller reads no links';
  end;

  begin
    perform public.redeem_link_code('ABCDEFGH');
    raise exception 'check failed: an anonymous caller can redeem a code';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous caller cannot redeem a code';
  end;

  -- A client cannot write the tables, read the codes or issue one.
  reset role;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;

  begin
    insert into public.player_links (user_id, recorder_id, player_uid, player_name)
    values (account_a, 'check-forged', 'uid-x', 'Forged');
    raise exception 'check failed: a client wrote a link directly';
  exception when insufficient_privilege then
    raise notice 'ok: a client cannot write a link directly';
  end;

  begin
    delete from public.player_links where user_id = account_a;
    raise exception 'check failed: a client deleted a link directly';
  exception when insufficient_privilege then
    raise notice 'ok: a client cannot delete a link directly';
  end;

  begin
    perform 1 from public.link_codes limit 1;
    raise exception 'check failed: a client can read the codes';
  exception when insufficient_privilege then
    raise notice 'ok: a client cannot read the codes';
  end;

  begin
    perform public.issue_link_code('check-recorder-a', 'ZZZZZZZZ', 'uid-a', 'Aurora', null,
      interval '10 minutes', 5, interval '1 hour');
    raise exception 'check failed: a client can issue a code';
  exception when insufficient_privilege then
    raise notice 'ok: a client cannot issue a code';
  end;

  -- Unlinking removes the link.
  perform set_config('request.jwt.claims', claims_b, true);
  perform public.unlink_player();

  select count(*) into seen from public.player_links where user_id = account_b;
  if seen <> 0 then
    raise exception 'check failed: unlinking left the link';
  end if;
  raise notice 'ok: unlinking removes the link';

  -- A caller with no account is refused.
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);

  begin
    perform public.redeem_link_code('ABCDEFGH');
    raise exception 'check failed: a caller with no account redeemed a code';
  exception when invalid_authorization_specification then
    raise notice 'ok: a caller with no account cannot redeem a code';
  end;

  -- A code is issued at most 5 times an hour per recorder.
  reset role;
  perform public.issue_link_code('check-recorder-e', 'AAAAAAA1', 'uid-e', 'Eclipse', null, interval '10 minutes', 2, interval '1 hour');
  perform public.issue_link_code('check-recorder-e', 'AAAAAAA2', 'uid-e', 'Eclipse', null, interval '10 minutes', 2, interval '1 hour');
  answer := public.issue_link_code('check-recorder-e', 'AAAAAAA3', 'uid-e', 'Eclipse', null, interval '10 minutes', 2, interval '1 hour');
  if answer ->> 'status' <> 'rate_limited' or (answer ->> 'retryAfter')::integer <= 0 then
    raise exception 'check failed: issuing is not rate limited (%)', answer;
  end if;
  raise notice 'ok: issuing codes is rate limited per recorder';

  -- An avatar that is not https is refused by the table itself.
  begin
    perform public.issue_link_code('check-recorder-f', 'BBBBBBB1', 'uid-f', 'Flare', 'http://content.overwolf.com/a.png',
      interval '10 minutes', 5, interval '1 hour');
    raise exception 'check failed: a non-https avatar was stored';
  exception when check_violation then
    raise notice 'ok: only an https avatar is stored';
  end;

  -- Deleting the Auth user deletes the link.
  delete from auth.users where id = account_b;

  select count(*) into seen from public.player_links where user_id = account_b;
  if seen <> 0 then
    raise exception 'check failed: deleting the Auth user left the link';
  end if;
  raise notice 'ok: deleting the Auth user deletes the link';
end
$$;

rollback;
