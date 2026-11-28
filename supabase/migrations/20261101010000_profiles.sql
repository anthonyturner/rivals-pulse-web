-- One row per website account (issue 270, ADR-0004). Additive only: touches no overlay-facing object.
--
-- The row is created when the account first signs in (by the website's callback), not by a
-- trigger on auth.users, so signing up never depends on this table. It holds no personal data yet;
-- later account settings (such as the live-status opt-in) and the link to an in-game identity are
-- their own additions. Deleting the Auth user deletes the row.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Supabase grants new tables to the API roles by default; keep only what an account needs on its own row.
revoke all on public.profiles from anon, authenticated;
grant select, insert on public.profiles to authenticated;

drop policy if exists "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Profiles are created by their owner" on public.profiles;
create policy "Profiles are created by their owner"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);
