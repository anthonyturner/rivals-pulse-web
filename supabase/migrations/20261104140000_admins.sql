-- The site administrator role (issue 290, ADR-0005). Additive: it adds one table and one function and
-- changes nothing the overlay calls.
--
-- Anyone can create an account, so a valid session says nothing about who may administer the site.
-- An admin is a row here, put there by the owner by hand (docs/supabase.md); no route of the website
-- writes it. Admin-only tables and functions reach their data only after `public.is_admin()` is true.

-- One row per administrator. Deleting the Auth user deletes the row, so a removed account is never
-- left holding the role.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note text
);

-- RLS on with no policy, and no grant to any API role: nothing reaches the table except the
-- function below and the owner's own SQL. Supabase grants new tables to the API roles by default,
-- the service role included; it is revoked too, so the website's service key cannot read or write
-- the table either (ADR-0005, decision 6).
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated, service_role;

-- Whether the signed-in account is an administrator. It reads the table on every call and keeps
-- nothing in the sign-in token, so deleting the row takes effect on the admin's next request.
-- It runs as its owner because the caller may not read `admins`, and it answers false, never an
-- error, for a caller with no account.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = (select auth.uid())
  )
$$;

-- Postgres lets `public` run a new function, and Supabase also grants it to `anon` by default.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
