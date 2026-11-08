-- Proves the team line-up rules (migrations 20261107140000 and 20261108140000) on fixture matches in a half-season that
-- does not exist, then rolls everything back. Run after applying the migration:
--   npx supabase db query --linked -f supabase/checks/team_lineup_shapes.sql
-- It fails with an exception naming the rule that broke; it ends with a rollback, never a commit.
-- The fixture sizes follow public.team_lineup_min_teams(), so changing the minimum needs no edit here.
begin;

do $$
declare
  m constant integer := public.team_lineup_min_teams();
  -- Matches whose team 1 is 2-2-2, and how many of them team 1 wins.
  a_end constant integer := m - 3;
  a_wins constant integer := (m - 3) / 2;
  -- Matches whose team 1 is 3-2-1: one team short of the minimum.
  b_len constant integer := m - 1;
  total_matches constant integer := 2 * m;
  n integer;
  players jsonb;
  first_players jsonb;
  dropped integer;
  team_one integer[];
  team_two integer[];
  one_two_three constant integer[] := array[1027, 1024, 1026, 1031, 1016, 1025];
  two_two_two constant integer[] := array[1011, 1022, 1014, 1015, 1020, 1023];
  three_two_one constant integer[] := array[1011, 1022, 1027, 1014, 1015, 1020];
  unknown_hero constant integer[] := array[1011, 1022, 1014, 1015, 1020, 0];
  deadpool_base constant integer[] := array[1011, 1022, 1014, 1015, 1020, 1057];
  deadpool_strategist constant integer[] := array[1011, 1022, 1014, 1015, 1020, 10573];
  shape record;
  totals record;
  read_back record;
  stored_shapes integer;
  listed integer;
begin
  if m <= 4 then
    raise exception 'this check needs a minimum above 4 teams';
  end if;
  if exists (select 1 from public.participants where half_season = 995) then
    raise exception 'test half-season already exists';
  end if;

  -- Competitive matches, one recorder, team 1 against a team 2 that is 1-2-3 unless noted (1 Vanguard,
  -- 2 Duelists, 3 Strategists). With the minimum m, a_end = m - 3:
  --   1 to a_end            team 1 is 2-2-2; it wins the first a_end / 2
  --   next b_len = m - 1    team 1 is 3-2-1 (m - 1 teams, one under the minimum) and wins
  --   then 1                a mirror match: both teams are 2-2-2, team 1 wins
  --   then 1                team 1 has hero id 0 (no hero recorded): unclassified; it wins
  --   then 1                team 1 has Deadpool's base id 1057 (no role): unclassified; it wins
  --   then 1                team 1 has Deadpool's Strategist form 10573: a classified 2-2-2; it wins
  -- So 2-2-2 has exactly m teams (a_end + 2 + 1), on the boundary, 1-2-3 has 2m - 1 and 3-2-1 m - 1.
  for n in 1..total_matches loop
    team_one := case
      when n <= a_end then two_two_two
      when n <= a_end + b_len then three_two_one
      when n = a_end + b_len + 1 then two_two_two
      when n = a_end + b_len + 2 then unknown_hero
      when n = a_end + b_len + 3 then deadpool_base
      else deadpool_strategist
    end;
    team_two := case when n = a_end + b_len + 1 then two_two_two else one_two_three end;

    select jsonb_agg(jsonb_build_object(
             'uid', 'tst-' || n || '-' || t.team || '-' || t.ord,
             'name', 'tst-' || n || '-' || t.team || '-' || t.ord,
             'team', t.team, 'hero_id', t.hero, 'kills', 1, 'deaths', 1, 'assists', 1,
             'is_win', (t.team = 1) = (n > a_end or n <= a_wins)))
      into players
    from (
      select 1 as team, h.hero, h.ord from unnest(team_one) with ordinality as h(hero, ord)
      union all
      select 2, h.hero, h.ord from unnest(team_two) with ordinality as h(hero, ord)
    ) t;

    first_players := coalesce(first_players, players);

    perform public.record_match_participants(
      'tst-lineup-' || n, 995, now() - make_interval(hours => n), 'tst-recorder', players, 1::smallint, null);
  end loop;

  -- The same first match recorded again by someone else: dropped whole, so counted once.
  dropped := public.record_match_participants(
    'tst-lineup-1', 995, now() - interval '59 minutes', 'tst-other-recorder', first_players, 1::smallint, null);
  if dropped <> 0 then
    raise exception 'the second upload of a match must be dropped';
  end if;

  perform public.rebuild_triple_support_aggregates(995);

  select count(*) into stored_shapes from public.team_lineup_shapes where half_season = 995;
  if stored_shapes <> 3 then
    raise exception 'exactly the shapes 2-2-2, 1-2-3 and 3-2-1 must be stored, got %', stored_shapes;
  end if;

  -- 2-2-2: a_end + both teams of the mirror match + the Deadpool Strategist form = m teams, exactly the
  -- minimum. Wins: a_wins, the mirror's winner and the last match. A match recorded twice counts once,
  -- or this would be higher.
  select * into shape from public.team_lineup_shapes
    where half_season = 995 and vanguards = 2 and duelists = 2 and strategists = 2;
  if not found or shape.play_mode_id <> 1 or shape.rank_bucket <> -1 or shape.teams <> m or shape.wins <> a_wins + 2 then
    raise exception 'shape 2-2-2 is wrong (a mirror match counts both teams, a duplicate upload once): %', shape;
  end if;

  -- 1-2-3: team 2 in every match but the mirror, including against the two unclassified teams. It wins
  -- exactly the matches team 1 loses among the first a_end.
  select * into shape from public.team_lineup_shapes
    where half_season = 995 and vanguards = 1 and duelists = 2 and strategists = 3;
  if not found or shape.teams <> 2 * m - 1 or shape.wins <> a_end - a_wins then
    raise exception 'shape 1-2-3 is wrong: %', shape;
  end if;

  select * into shape from public.team_lineup_shapes
    where half_season = 995 and vanguards = 3 and duelists = 2 and strategists = 1;
  if not found or shape.teams <> m - 1 or shape.wins <> m - 1 then
    raise exception 'shape 3-2-1 is wrong: %', shape;
  end if;

  select * into totals from public.triple_support_totals where half_season = 995;
  if not found or totals.matches <> total_matches or totals.recorders <> 1 then
    raise exception 'wrong totals: %', totals;
  end if;
  if totals.classified_teams <> 4 * m - 2 or totals.unclassified_teams <> 2 then
    raise exception 'a team with an unknown hero must be unclassified, not dropped: %', totals;
  end if;
  if totals.classified_teams <> (select sum(teams) from public.team_lineup_shapes where half_season = 995) then
    raise exception 'the classified teams must be exactly the teams of the shapes';
  end if;

  -- The trio family shares the rebuild and must be unchanged: team 2 is the one trio in 2m - 1 matches.
  select * into shape from public.triple_support_trios where half_season = 995;
  if not found or (select count(*) from public.triple_support_trios where half_season = 995) <> 1
     or (shape.hero_a, shape.hero_b, shape.hero_c) <> (1016, 1025, 1031) or shape.teams <> 2 * m - 1 then
    raise exception 'the trio rebuild changed: %', shape;
  end if;

  -- The reader: 2-2-2 sits exactly on the minimum and 1-2-3 is over it, so both carry their counts;
  -- 3-2-1, one under it, is "not enough data": its team count comes back, its wins do not.
  select count(*) into listed from public.read_team_lineup_shapes(array[1]::smallint[]) where half_season = 995;
  if listed <> 3 then
    raise exception 'the reader must list every stored shape, thin ones included, got %', listed;
  end if;

  select * into read_back from public.read_team_lineup_shapes(array[1]::smallint[])
    where half_season = 995 and vanguards = 2 and duelists = 2 and strategists = 2;
  if not found or not read_back.enough_data or read_back.teams <> m or read_back.wins <> a_wins + 2
     or read_back.classified_teams <> 4 * m - 2 or read_back.unclassified_teams <> 2 then
    raise exception 'the reader must return a shape exactly at the minimum with its counts: %', read_back;
  end if;

  select * into read_back from public.read_team_lineup_shapes(array[1]::smallint[])
    where half_season = 995 and vanguards = 3 and duelists = 2 and strategists = 1;
  if not found or read_back.enough_data or read_back.teams <> m - 1 or read_back.wins is not null then
    raise exception 'a shape under the minimum must carry its team count and no wins: %', read_back;
  end if;

  if exists (select 1 from public.read_team_lineup_shapes(array[0, 2, 3]::smallint[]) where half_season = 995) then
    raise exception 'a mode that was not asked for must not be returned';
  end if;

  -- Freezing keeps the shapes after the raw rows go, and a later rebuild cannot wipe them.
  perform public.rebuild_triple_support_aggregates(995, true);
  delete from public.participants where half_season = 995;
  if public.rebuild_triple_support_aggregates(995) then
    raise exception 'a frozen half-season must not be rebuilt';
  end if;
  if (select count(*) from public.team_lineup_shapes where half_season = 995) <> 3 then
    raise exception 'freezing must keep the shapes';
  end if;

  if has_table_privilege('anon', 'public.team_lineup_shapes', 'select')
     or has_table_privilege('authenticated', 'public.team_lineup_shapes', 'select') then
    raise exception 'the shape counts must not be readable by the publishable key';
  end if;
  if not has_function_privilege('anon', 'public.read_team_lineup_shapes(smallint[])', 'execute')
     or has_function_privilege('authenticated', 'public.read_team_lineup_shapes(smallint[])', 'execute')
     or has_function_privilege('anon', 'public.fill_triple_support_aggregates(numeric)', 'execute') then
    raise exception 'function permissions changed';
  end if;
end
$$;

rollback;
