-- Checks the "Show me in Pulse Records" switch (issue 568, ADR-0006): it is off by default, only the
-- account's owner can read or change it, it needs a link to be turned on, it sets updated_at, and it
-- goes back to off whenever the link ends or is replaced. Everything is planted inside one transaction
-- that ends in a rollback, with throwaway accounts and recorders.
--
-- Run it by hand after the migrations are applied (20261107100000, 20261107100100 and 20261107110000);
-- it changes nothing:
--   npx supabase db query --linked -f supabase/checks/records_opt_in.sql
-- Judge it by its exit status. Every failure is an exception ("check failed: ...") that stops the
-- script with a non-zero exit; the notices are for reading, and the last one is reached only when
-- nothing raised.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  account_c uuid := gen_random_uuid();
  account_d uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  claims_d text;
  answer jsonb;
  seen integer;
  stamp timestamptz;
  old_stamp constant timestamptz := now() - interval '1 day';
begin
  insert into auth.users (id, email)
  values
    (account_a, 'optin-check-a@example.invalid'),
    (account_b, 'optin-check-b@example.invalid'),
    (account_c, 'optin-check-c@example.invalid'),
    (account_d, 'optin-check-d@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;
  claims_d := json_build_object('sub', account_d, 'role', 'authenticated')::text;

  -- Off by default: nobody has a settings row until they choose.
  if exists (select 1 from public.account_settings where user_id in (account_a, account_b, account_c, account_d)) then
    raise exception 'check failed: a new account already has a settings row';
  end if;
  raise notice 'ok: a new account has no setting, which reads as off';

  -- Turning it on needs a link, and a refusal writes nothing.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_records_opt_in(true);
  reset role;
  if answer ->> 'status' <> 'not_linked' then
    raise exception 'check failed: an unlinked account turned the switch on (%)', answer;
  end if;
  if exists (select 1 from public.account_settings where user_id = account_a) then
    raise exception 'check failed: a refused switch wrote a row';
  end if;
  raise notice 'ok: the switch cannot be turned on without a link, and a refusal writes nothing';

  insert into public.player_links (user_id, recorder_id, player_uid, player_name)
  values
    (account_a, 'optin-rec-a', 'optin-uid-a', 'Aurora'),
    (account_b, 'optin-rec-b', 'optin-uid-b', 'Borealis'),
    (account_c, 'optin-rec-c', 'optin-uid-c', 'Corona');

  -- Turning it on works for a linked account, and sets updated_at.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_records_opt_in(true);
  reset role;
  if answer is distinct from jsonb_build_object('status', 'saved', 'showInRecords', true) then
    raise exception 'check failed: a linked account could not turn the switch on (%)', answer;
  end if;
  if not (select show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: the switch did not save as on';
  end if;
  raise notice 'ok: a linked account turns the switch on';

  update public.account_settings set updated_at = old_stamp where user_id = account_a;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_records_opt_in(false);
  reset role;
  select updated_at into stamp from public.account_settings where user_id = account_a;
  if stamp <= old_stamp or (select show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: switching off did not save with a fresh updated_at (%, %)', answer, stamp;
  end if;
  raise notice 'ok: switching off saves and sets updated_at';

  -- The function takes no account id: it can only act on the caller. B switching on changes B's row only.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  perform public.set_records_opt_in(true);
  reset role;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  perform public.set_records_opt_in(false);

  -- Owner only: B reads no row of A's, whatever B asks for.
  select count(*) into seen from public.account_settings where user_id = account_a;
  if seen <> 0 then
    raise exception 'check failed: account B can read account A''s setting';
  end if;
  select count(*) into seen from public.account_settings;
  if seen <> 1 then
    raise exception 'check failed: account B sees % settings rows, not its own one', seen;
  end if;
  raise notice 'ok: an account reads only its own setting';

  -- No client can write the table directly, in either direction, for itself or for anyone else.
  begin
    update public.account_settings set show_in_records = true where user_id = account_b;
    raise exception 'check failed: an account can update the settings table directly';
  exception when insufficient_privilege then
    raise notice 'ok: an account cannot update the settings table directly';
  end;
  begin
    insert into public.account_settings (user_id, show_in_records) values (account_c, true);
    raise exception 'check failed: an account can insert into the settings table directly';
  exception when insufficient_privilege then
    raise notice 'ok: an account cannot insert into the settings table directly';
  end;
  begin
    delete from public.account_settings where user_id = account_b;
    raise exception 'check failed: an account can delete from the settings table directly';
  exception when insufficient_privilege then
    raise notice 'ok: an account cannot delete from the settings table directly';
  end;
  reset role;

  if not (select show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: account B''s calls changed account A''s setting';
  end if;
  raise notice 'ok: the switch acts on the caller alone';

  -- An empty choice is refused, and so is a caller who is not signed in.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  begin
    perform public.set_records_opt_in(null);
    raise exception 'check failed: an empty choice was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: an empty choice is refused';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_records_opt_in(true);
    raise exception 'check failed: a caller with no account changed the switch';
  exception when sqlstate '28000' then
    raise notice 'ok: a caller with no account is refused';
  end;
  reset role;

  -- Only a signed-in account may call it: the publishable key alone and the service role may not.
  begin
    set local role anon;
    perform public.set_records_opt_in(true);
    raise exception 'check failed: an anonymous client can call the switch';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous client cannot call the switch';
  end;
  reset role;
  begin
    set local role service_role;
    perform public.set_records_opt_in(true);
    raise exception 'check failed: the service role can call the switch';
  exception when insufficient_privilege then
    raise notice 'ok: the service role cannot call the switch';
  end;
  reset role;

  -- The reset function is not callable by any API role (it is a trigger, never an endpoint).
  begin
    set local role authenticated;
    perform public.reset_records_opt_in();
    raise exception 'check failed: an account can call the reset function';
  exception when insufficient_privilege then
    raise notice 'ok: the reset function is closed to API roles';
  end;
  reset role;

  -- Unlinking from the website switches it off, and sets updated_at. A is on from above.
  update public.account_settings set updated_at = old_stamp where user_id = account_a;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  perform public.unlink_player();
  reset role;
  select updated_at into stamp from public.account_settings where user_id = account_a;
  if (select show_in_records from public.account_settings where user_id = account_a) or stamp <= old_stamp then
    raise exception 'check failed: unlinking left the switch on or did not set updated_at';
  end if;
  raise notice 'ok: unlinking from the website switches it off';

  -- A stays off after a link to a different player, until A chooses again.
  insert into public.link_codes (recorder_id, code_hash, player_uid, player_name, expires_at)
  values ('optin-rec-a2', public.link_code_hash('OPTINAAA'), 'optin-uid-a2', 'Another Player', now() + interval '10 minutes');
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.redeem_link_code('OPTINAAA');
  reset role;
  if answer ->> 'status' <> 'linked' then
    raise exception 'check failed: A could not link a new player (%)', answer;
  end if;
  if (select show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: a new link was named without the account choosing again';
  end if;
  raise notice 'ok: a new link starts off';

  -- Linking a different player over a live link switches it off (the relink path).
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  perform public.set_records_opt_in(true);
  reset role;
  insert into public.link_codes (recorder_id, code_hash, player_uid, player_name, expires_at)
  values ('optin-rec-a3', public.link_code_hash('OPTINBBB'), 'optin-uid-a3', 'Third Player', now() + interval '10 minutes');
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.redeem_link_code('OPTINBBB');
  reset role;
  if answer ->> 'status' <> 'linked' then
    raise exception 'check failed: A could not relink over a live link (%)', answer;
  end if;
  if (select show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: relinking to another player left the switch on';
  end if;
  raise notice 'ok: relinking to another player switches it off';

  -- Another account taking the recorder ("latest proof wins") switches the loser off.
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  perform public.set_records_opt_in(true);
  reset role;
  insert into public.link_codes (recorder_id, code_hash, player_uid, player_name, expires_at)
  values ('optin-rec-b', public.link_code_hash('OPTINCCC'), 'optin-uid-b', 'Borealis', now() + interval '10 minutes');
  perform set_config('request.jwt.claims', json_build_object('sub', account_c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  answer := public.redeem_link_code('OPTINCCC');
  reset role;
  if answer ->> 'status' <> 'linked' then
    raise exception 'check failed: C could not take B''s recorder (%)', answer;
  end if;
  if exists (select 1 from public.player_links where user_id = account_b) then
    raise exception 'check failed: B kept a link another account took';
  end if;
  if (select show_in_records from public.account_settings where user_id = account_b) then
    raise exception 'check failed: an account that lost its link to another account is still switched on';
  end if;
  raise notice 'ok: losing the link to another account switches it off';

  -- Unlinking from the desktop app switches it off too.
  insert into public.player_links (user_id, recorder_id, player_uid, player_name)
  values (account_d, 'optin-rec-d', 'optin-uid-d', 'Dawn');
  perform set_config('request.jwt.claims', claims_d, true);
  set local role authenticated;
  perform public.set_records_opt_in(true);
  reset role;
  set local role service_role;
  answer := public.unlink_player_for_recorder('optin-rec-d', 100);
  reset role;
  if answer ->> 'status' <> 'unlinked' then
    raise exception 'check failed: the app could not unlink D (%)', answer;
  end if;
  if (select show_in_records from public.account_settings where user_id = account_d) then
    raise exception 'check failed: unlinking from the app left the switch on';
  end if;
  raise notice 'ok: unlinking from the desktop app switches it off';

  -- Switching off never needs a link, and a stored "on" cannot outlive the link it was given for.
  perform set_config('request.jwt.claims', claims_d, true);
  set local role authenticated;
  answer := public.set_records_opt_in(false);
  reset role;
  if answer ->> 'status' <> 'saved' then
    raise exception 'check failed: an unlinked account could not switch off (%)', answer;
  end if;
  raise notice 'ok: switching off needs no link';

  -- Deleting an account with the switch on and a link still works (the reset runs inside the cascade).
  update public.account_settings set show_in_records = true where user_id = account_a;
  delete from auth.users where id = account_a;
  if exists (select 1 from public.account_settings where user_id = account_a)
    or exists (select 1 from public.player_links where user_id = account_a) then
    raise exception 'check failed: deleting an account left its setting or link behind';
  end if;
  raise notice 'ok: deleting an account removes its setting and link';

  raise notice 'all Pulse Records switch checks passed';
end
$$;

rollback;
