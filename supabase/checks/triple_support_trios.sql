-- Proves the triple-support rules (migration 20261107120000) on fixture matches in a half-season that
-- does not exist, then rolls everything back. Run after applying the migration:
--   npx supabase db query --linked -f supabase/checks/triple_support_trios.sql
-- It fails with an exception naming the rule that broke; it ends with a rollback, never a commit.
begin;

do $$
declare
  fx record;
  players jsonb;
  first_players jsonb;
  dropped integer;
  stored record;
  read_back record;
  other_team constant integer[] := array[1022, 1024, 1026, 1027, 1029, 1030];
begin
  if exists (select 1 from public.participants where half_season = 996) then
    raise exception 'test half-season already exists';
  end if;

  -- Ten matches where team 1 ran Mantis (1020), Luna Snow (1031) and Rocket Raccoon (1023) with three
  -- non-Strategists (team 1 lost the first six and won the other four), then four matches that must never become that trio:
  -- four Strategists (a shape only), hero id 0 (no hero recorded), Deadpool's base id 1057 (no role),
  -- and one more trio (Deadpool's Strategist form 10573, Luna, Loki) far below the minimum.
  for fx in
    select * from (values
      (1, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (2, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (3, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (4, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (5, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (6, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (7, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (8, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (9, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (10, array[1020, 1031, 1023, 1011, 1014, 1015]),
      (11, array[1020, 1031, 1023, 1025, 1011, 1014]),
      (12, array[0, 1020, 1031, 1023, 1011, 1014]),
      (13, array[1057, 1031, 1023, 1011, 1014, 1015]),
      (14, array[10573, 1031, 1016, 1011, 1014, 1015])
    ) as v(n, team_one)
  loop
    select jsonb_agg(jsonb_build_object(
             'uid', 'tst-' || fx.n || '-' || t.team || '-' || t.ord,
             'name', 'tst-' || fx.n || '-' || t.team || '-' || t.ord,
             'team', t.team, 'hero_id', t.hero, 'kills', 1, 'deaths', 1, 'assists', 1,
             'is_win', (t.team = 1) = (fx.n > 6)))
      into players
    from (
      select 1 as team, h.hero, h.ord from unnest(fx.team_one) with ordinality as h(hero, ord)
      union all
      select 2, h.hero, h.ord from unnest(other_team) with ordinality as h(hero, ord)
    ) t;

    first_players := coalesce(first_players, players);

    perform public.record_match_participants(
      'tst-trio-' || fx.n, 996, now() - make_interval(hours => fx.n), 'tst-recorder', players, 1::smallint, null);
  end loop;

  -- The same first match recorded again by someone else: dropped whole, so counted once.
  dropped := public.record_match_participants(
    'tst-trio-1', 996, now() - interval '59 minutes', 'tst-other-recorder', first_players, 1::smallint, null);
  if dropped <> 0 then
    raise exception 'the second upload of a match must be dropped';
  end if;

  perform public.rebuild_triple_support_aggregates(996);

  select * into stored from public.triple_support_trios where half_season = 996;
  if not found or (select count(*) from public.triple_support_trios where half_season = 996) <> 1 then
    raise exception 'exactly one trio must be stored (the one at the minimum)';
  end if;
  if (stored.hero_a, stored.hero_b, stored.hero_c) <> (1020, 1023, 1031)
     or stored.play_mode_id <> 1 or stored.rank_bucket <> -1 then
    raise exception 'wrong trio stored: %', stored;
  end if;
  if stored.matches <> 10 or stored.teams <> 10 or stored.wins <> 4 then
    raise exception 'a match recorded twice must count once, and wins come from the team''s side: %', stored;
  end if;

  select * into stored from public.triple_support_totals where half_season = 996;
  if stored.matches <> 14 or stored.recorders <> 1 or stored.top_recorder_matches <> 14 then
    raise exception 'wrong totals: %', stored;
  end if;
  if stored.classified_teams <> 26 or stored.unclassified_teams <> 2 or stored.four_plus_teams <> 1 then
    raise exception 'a team with an unknown hero must be unclassified, not dropped, and four Strategists a shape only: %', stored;
  end if;

  select * into read_back from public.read_triple_support_trios(array[1]::smallint[]) where half_season = 996;
  if not found or read_back.matches <> 10 or read_back.classified_teams <> 26 or read_back.unclassified_teams <> 2 then
    raise exception 'the reader must return the trio with its half-season counts: %', read_back;
  end if;
  if exists (select 1 from public.read_triple_support_trios(array[0]::smallint[]) where half_season = 996) then
    raise exception 'a mode that was not asked for must not be returned';
  end if;

  if has_table_privilege('anon', 'public.triple_support_trios', 'select')
     or has_table_privilege('authenticated', 'public.triple_support_totals', 'select')
     or has_table_privilege('anon', 'public.hero_game_roles', 'select') then
    raise exception 'the count tables must not be readable by the publishable key';
  end if;
  if not has_function_privilege('anon', 'public.read_triple_support_trios(smallint[])', 'execute')
     or has_function_privilege('authenticated', 'public.read_triple_support_trios(smallint[])', 'execute')
     or has_function_privilege('anon', 'public.rebuild_triple_support_aggregates(numeric, boolean)', 'execute') then
    raise exception 'function permissions changed';
  end if;
end
$$;

rollback;
