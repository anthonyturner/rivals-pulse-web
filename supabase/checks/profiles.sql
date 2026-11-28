-- Checks the rules of public.profiles (issue 270): an anonymous caller reads nothing, one account
-- cannot read or create another's row, and deleting the Auth user deletes the row.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/profiles.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  seen integer;
begin
  insert into auth.users (id, email)
  values (account_a, 'profiles-check-a@example.invalid'), (account_b, 'profiles-check-b@example.invalid');

  perform set_config('request.jwt.claims', json_build_object('sub', account_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.profiles (user_id) values (account_a);

  begin
    insert into public.profiles (user_id) values (account_b);
    raise exception 'check failed: account A created a row for account B';
  exception when insufficient_privilege then
    raise notice 'ok: an account cannot create another account''s row';
  end;

  reset role;
  insert into public.profiles (user_id) values (account_b);

  perform set_config('request.jwt.claims', json_build_object('sub', account_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into seen from public.profiles where user_id = account_b;
  if seen <> 0 then
    raise exception 'check failed: account A can read account B''s row';
  end if;
  raise notice 'ok: an account cannot read another account''s row';

  select count(*) into seen from public.profiles where user_id = account_a;
  if seen <> 1 then
    raise exception 'check failed: account A cannot read its own row';
  end if;
  raise notice 'ok: an account reads its own row';

  reset role;
  set local role anon;

  begin
    perform 1 from public.profiles limit 1;
    raise exception 'check failed: an anonymous caller can read profiles';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous caller reads nothing';
  end;

  reset role;
  delete from auth.users where id = account_a;

  select count(*) into seen from public.profiles where user_id = account_a;
  if seen <> 0 then
    raise exception 'check failed: deleting the Auth user left the profile row';
  end if;
  raise notice 'ok: deleting the Auth user deletes the row';
end
$$;

rollback;
