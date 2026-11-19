create table if not exists public.player_hero_profiles (
  player_id bigint not null references public.players (id) on delete cascade,
  season numeric(4,1) not null,
  player_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, season)
);

create table if not exists public.player_hero_stats (
  player_id bigint not null references public.players (id) on delete cascade,
  season numeric(4,1) not null,
  playlist text not null check (playlist in ('ranked', 'unranked')),
  hero_key text not null,
  hero_id bigint,
  hero_name text,
  hero_type text,
  hero_thumbnail text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, season, playlist, hero_key)
);

create index if not exists player_hero_stats_player_season_idx
  on public.player_hero_stats (player_id, season, playlist);

create table if not exists public.hero_stats_sync_state (
  player_id bigint not null references public.players (id) on delete cascade,
  season numeric(4,1) not null,
  last_synced_at timestamptz not null,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (player_id, season)
);

alter table public.player_hero_profiles enable row level security;
alter table public.player_hero_stats enable row level security;
alter table public.hero_stats_sync_state enable row level security;

revoke insert, update, delete on public.player_hero_profiles from anon, authenticated;
revoke insert, update, delete on public.player_hero_stats from anon, authenticated;
revoke all on public.hero_stats_sync_state from anon, authenticated;

grant select on public.player_hero_profiles to anon, authenticated;
grant select on public.player_hero_stats to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_hero_profiles'
      and policyname = 'Public player hero-profile reads'
  ) then
    create policy "Public player hero-profile reads"
      on public.player_hero_profiles for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'player_hero_stats'
      and policyname = 'Public player hero-stat reads'
  ) then
    create policy "Public player hero-stat reads"
      on public.player_hero_stats for select to anon, authenticated using (true);
  end if;
end
$$;
