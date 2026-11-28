-- Per-account switches, starting with whether the account's linked player may be named on the
-- Pulse Records boards. Additive: one new table, nothing the overlay calls.
--
-- Naming is off until the owner turns it on. The website changes it through a function of its own
-- (a later change); a client never writes this table, so the grant below is read-only.
create table if not exists public.account_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  show_in_records boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.account_settings enable row level security;

-- Supabase also grants new tables to service_role; nothing server-side needs this one, so close it.
revoke all on public.account_settings from anon, authenticated, service_role;
grant select on public.account_settings to authenticated;

drop policy if exists "Settings are readable by their owner" on public.account_settings;
create policy "Settings are readable by their owner"
  on public.account_settings for select to authenticated
  using ((select auth.uid()) = user_id);
