-- Checks the media defaults (issue 705): both are off until chosen, each saves on its own, only the
-- account's owner can read or change them, they never touch the Pulse Records switch, and the
-- function refuses a caller with no account, an empty choice and every role but a signed-in one.
-- Everything is planted inside one transaction that ends in a rollback, with throwaway accounts.
--
-- Run it by hand after the migrations are applied (20261107100000 and 20261109120000); it changes
-- nothing:
--   npx supabase db query --linked -f supabase/checks/media_defaults.sql
-- Judge it by its exit status. Every failure is an exception ("check failed: ...") that stops the
-- script with a non-zero exit; the notices are for reading, and the last one is reached only when
-- nothing raised.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  answer jsonb;
  seen integer;
  stamp timestamptz;
  old_stamp constant timestamptz := now() - interval '1 day';
begin
  insert into auth.users (id, email)
  values
    (account_a, 'media-check-a@example.invalid'),
    (account_b, 'media-check-b@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;

  -- Off by default: nobody has a settings row until they choose.
  if exists (select 1 from public.account_settings where user_id in (account_a, account_b)) then
    raise exception 'check failed: a new account already has a settings row';
  end if;
  raise notice 'ok: a new account has no row, which reads as both off';

  -- A first save of one setting creates the row with the other off.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_media_defaults(p_hero_video => true);
  reset role;
  if answer is distinct from jsonb_build_object('status', 'saved', 'heroVideo', true, 'sound', false) then
    raise exception 'check failed: the first save answered %', answer;
  end if;
  raise notice 'ok: a first save of the video default leaves the sound default off';

  -- Each setting saves on its own, and leaves the other as it was.
  update public.account_settings set updated_at = old_stamp where user_id = account_a;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_media_defaults(p_sound => true);
  reset role;
  select updated_at into stamp from public.account_settings where user_id = account_a;
  if answer is distinct from jsonb_build_object('status', 'saved', 'heroVideo', true, 'sound', true) or stamp <= old_stamp then
    raise exception 'check failed: saving the sound default changed the video default or kept a stale updated_at (%, %)', answer, stamp;
  end if;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_media_defaults(p_hero_video => false);
  reset role;
  if answer is distinct from jsonb_build_object('status', 'saved', 'heroVideo', false, 'sound', true) then
    raise exception 'check failed: switching the video default off changed the sound default (%)', answer;
  end if;
  raise notice 'ok: each default saves on its own and sets updated_at';

  -- Both can be saved in one call.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.set_media_defaults(true, false);
  reset role;
  if answer is distinct from jsonb_build_object('status', 'saved', 'heroVideo', true, 'sound', false) then
    raise exception 'check failed: saving both defaults answered %', answer;
  end if;
  raise notice 'ok: both defaults save together';

  -- The function takes no account id: B saving changes B's row only, and the Pulse Records switch is untouched.
  update public.account_settings set show_in_records = true, sound_default = true where user_id = account_a;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  perform public.set_media_defaults(false, true);

  -- Owner only: B reads no row of A's, and sees only its own.
  select count(*) into seen from public.account_settings where user_id = account_a;
  if seen <> 0 then
    raise exception 'check failed: account B can read account A''s settings';
  end if;
  select count(*) into seen from public.account_settings;
  if seen <> 1 then
    raise exception 'check failed: account B sees % settings rows, not its own one', seen;
  end if;
  raise notice 'ok: an account reads only its own defaults';

  -- No client writes the table directly.
  begin
    update public.account_settings set hero_video_default = true where user_id = account_b;
    raise exception 'check failed: an account can update the settings table directly';
  exception when insufficient_privilege then
    raise notice 'ok: an account cannot update the settings table directly';
  end;
  reset role;

  if not (select hero_video_default and sound_default and show_in_records from public.account_settings where user_id = account_a) then
    raise exception 'check failed: account B''s calls changed account A''s settings';
  end if;
  raise notice 'ok: the function acts on the caller alone and leaves the Pulse Records switch alone';

  -- An empty choice is refused, and so is a caller who is not signed in.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  begin
    perform public.set_media_defaults();
    raise exception 'check failed: an empty choice was accepted';
  exception when sqlstate '22004' then
    raise notice 'ok: an empty choice is refused';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.set_media_defaults(true, true);
    raise exception 'check failed: a caller with no account saved a default';
  exception when sqlstate '28000' then
    raise notice 'ok: a caller with no account is refused';
  end;
  reset role;

  -- Only a signed-in account may call it.
  begin
    set local role anon;
    perform public.set_media_defaults(true, true);
    raise exception 'check failed: an anonymous client can call the function';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous client cannot call the function';
  end;
  reset role;
  begin
    set local role service_role;
    perform public.set_media_defaults(true, true);
    raise exception 'check failed: the service role can call the function';
  exception when insufficient_privilege then
    raise notice 'ok: the service role cannot call the function';
  end;
  reset role;

  raise notice 'all media default checks passed';
end
$$;

rollback;
