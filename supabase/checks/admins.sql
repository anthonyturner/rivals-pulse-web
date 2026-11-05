-- Checks the rules of the administrator role (issue 290, ADR-0005): only a row in public.admins makes
-- an account an administrator, a signed-in account that is not one is told so and cannot read or write
-- the table, nobody signed out can ask at all, revoking takes effect on the very next call, and
-- deleting the Auth user deletes the row.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/admins.sql
-- It prints a notice per passing check and raises an exception at the first failure.
--
-- It never grants admin to a real account: it makes two throwaway users inside the transaction.

begin;

do $$
declare
  admin_account uuid := gen_random_uuid();
  other_account uuid := gen_random_uuid();
  admin_claims text;
  other_claims text;
  seen integer;
begin
  insert into auth.users (id, email)
  values
    (admin_account, 'admins-check-admin@example.invalid'),
    (other_account, 'admins-check-other@example.invalid');

  admin_claims := json_build_object('sub', admin_account, 'role', 'authenticated')::text;
  other_claims := json_build_object('sub', other_account, 'role', 'authenticated')::text;

  -- Granting is the owner's SQL, run here as the owner (the role this script runs as).
  insert into public.admins (user_id, note) values (admin_account, 'admins.sql check');

  perform set_config('request.jwt.claims', admin_claims, true);
  set local role authenticated;

  if public.is_admin() is distinct from true then
    raise exception 'check failed: an account with a row was not an administrator';
  end if;
  raise notice 'ok: an account with a row is an administrator';

  perform set_config('request.jwt.claims', other_claims, true);

  if public.is_admin() is distinct from false then
    raise exception 'check failed: a signed-in account with no row was an administrator';
  end if;
  raise notice 'ok: a signed-in account with no row is not an administrator';

  -- An anonymous Supabase session is an authenticated account with no row, so it is not one either.
  perform set_config('request.jwt.claims',
    json_build_object('sub', other_account, 'role', 'authenticated', 'is_anonymous', true)::text, true);

  if public.is_admin() is distinct from false then
    raise exception 'check failed: an anonymous session was an administrator';
  end if;
  raise notice 'ok: an anonymous session is not an administrator';

  -- A signed-in non-admin, and an admin, cannot reach the table itself: only the function can.
  perform set_config('request.jwt.claims', other_claims, true);

  begin
    perform 1 from public.admins limit 1;
    raise exception 'check failed: a signed-in account read public.admins directly';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in non-admin cannot read the admin table';
  end;

  begin
    insert into public.admins (user_id) values (other_account);
    raise exception 'check failed: a signed-in account made itself an administrator';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in account cannot make itself an administrator';
  end;

  perform set_config('request.jwt.claims', admin_claims, true);

  begin
    perform 1 from public.admins limit 1;
    raise exception 'check failed: an administrator read public.admins directly';
  exception when insufficient_privilege then
    raise notice 'ok: even an administrator reads the table only through the function';
  end;

  begin
    delete from public.admins where user_id = admin_account;
    raise exception 'check failed: an administrator deleted its own row through the API role';
  exception when insufficient_privilege then
    raise notice 'ok: an administrator cannot grant or revoke through the API role';
  end;

  -- Nobody signed out can ask the question at all.
  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  begin
    perform public.is_admin();
    raise exception 'check failed: the anon role ran is_admin()';
  exception when insufficient_privilege then
    raise notice 'ok: the anon role cannot run is_admin()';
  end;

  begin
    perform 1 from public.admins limit 1;
    raise exception 'check failed: the anon role read public.admins';
  exception when insufficient_privilege then
    raise notice 'ok: the anon role cannot read the admin table';
  end;

  -- Revoking is a delete by the owner, and the next call sees it: nothing is kept in the token.
  reset role;
  delete from public.admins where user_id = admin_account;
  perform set_config('request.jwt.claims', admin_claims, true);
  set local role authenticated;

  if public.is_admin() is distinct from false then
    raise exception 'check failed: a revoked administrator was still one';
  end if;
  raise notice 'ok: revoking takes effect on the next call';

  -- Deleting the Auth user deletes the row.
  reset role;
  insert into public.admins (user_id) values (other_account);
  delete from auth.users where id = other_account;

  select count(*) into seen from public.admins where user_id = other_account;
  if seen <> 0 then
    raise exception 'check failed: deleting the account left its admin row behind';
  end if;
  raise notice 'ok: deleting the account deletes its admin row';
end
$$;

rollback;
