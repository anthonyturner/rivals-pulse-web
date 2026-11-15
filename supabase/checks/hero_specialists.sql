-- Proves the specialist and flex rules of 20261111120000_hero_specialists.sql (issue 819) and the 2-person gate of
-- 20261115120000_hero_specialists_two_people.sql (issue 871) on fixture matches in a half-season that does not
-- exist, then rolls everything back. Run it after both migrations are applied:
--   npx supabase db query --linked -f supabase/checks/hero_specialists.sql
-- It fails with an exception naming the rule that broke; it ends with a rollback, never a commit.
--
-- The fixture is a list of plans. A plan is a group of people who each play `rounds` matches on one hero; round r
-- of a plan is one match holding every person's line, so a match is one recorder's upload. A person wins the
-- rounds up to `wins`. Everything is sized for the shipped rules (2 people, 2 recorders, 50 matches per bucket;
-- 50 percent and 10 matches to specialise; under 25 percent over 5 heroes and 20 matches to flex), so changing a
-- rule needs the fixture changed with it.
--
-- Hero 9001 passes at the edge of every gate: 2 specialists (30 of 50 won) and 2 flex people (20 of 50 won), each
-- bucket on 2 recorders. The near misses each fail one gate: 9002 has one specialist (50 matches, 2 recorders),
-- 9006 one flex person (50 matches, 2 recorders), 9003 has one recorder behind its specialists, 9004 one behind its
-- flex people, 9005 only 44 flex matches. Hero 1057 is Deadpool, whose specialists played 9 matches each on three
-- role forms: only the merged 27 make them specialists, and the flex people's 13 and 12 make 25 each. The other
-- people must change nothing: 5 "middle" people (40 percent on 9001, neither specialist nor flex, all wins), 5
-- people with no uid (a specialist's record by name, all wins), and a specialist's extra matches with no result or
-- in Arcade (all wins).
begin;

do $$
declare
  answer jsonb;
  row_9001 jsonb;
  row_1057 jsonb;
  shown integer;
  keys text;
begin
  if exists (select 1 from public.participants where half_season = 993)
     or exists (select 1 from public.half_seasons where half_season = 993) then
    raise exception 'test half-season already exists';
  end if;
  -- The participants trigger sets half_season from played_at and public.half_seasons. This start sits before the
  -- fixture's 2099 matches and after every real half-season, so the trigger leaves them in 993.
  insert into public.half_seasons (half_season, starts_at) values (993, '2098-01-01T00:00:00Z');
  if (select count(*) from public.hero_game_roles where game_id in (10571, 10572, 10573) and base_game_id = 1057) <> 3 then
    raise exception 'this check needs the three Deadpool role forms in hero_game_roles';
  end if;
  if public.hero_specialist_min_share_percent() <> 50 or public.hero_specialist_min_hero_matches() <> 10
     or public.hero_flex_max_top_share_percent() <> 25 or public.hero_flex_min_heroes() <> 5
     or public.hero_flex_min_matches() <> 20 or public.hero_specialist_min_players() <> 2
     or public.hero_specialist_min_recorders() <> 2 or public.hero_specialist_min_bucket_matches() <> 50 then
    raise exception 'the fixture is sized for the shipped rules; update it with the rules';
  end if;

  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, is_win, recorded_by, play_mode_id)
  select 'tst-spec-' || pl.id || '-' || r.r,
         993.0,
         '2099-01-01T00:00:00Z'::timestamptz + (pl.ord * 100 + r.r) * interval '1 minute',
         case when pl.named_only then null else 'tst-spec-' || pl.prefix || '-' || i.i end,
         'tst-spec-' || pl.prefix || '-' || i.i,
         1,
         pl.hero,
         case when pl.wins is null then null else r.r <= pl.wins end,
         case when pl.recorders = 'one' or r.r % 2 = 1 then 'tst-spec-recorder-1' else 'tst-spec-recorder-2' end,
         pl.mode
  from (
    select row_number() over () as ord, v.*
    from (values
      -- id, prefix, people, hero, rounds, wins, recorders, mode, named_only
      ('s1',  'g1', 2, 9001,  25, 15,   'alt', 1, false),
      ('s1n', 'g1', 1, 9001,   5, null, 'alt', 1, false),
      ('s1m', 'g1', 1, 9001,   5, 5,    'alt', 2, false),
      ('s1f', 'g1', 2, 9100,   2, 1,    'alt', 1, false),
      ('s2',  'g2', 1, 9002,  50, 28,   'alt', 1, false),
      ('s2f', 'g2', 1, 9100,   2, 1,    'alt', 1, false),
      ('s3',  'g3', 2, 9003,  25, 15,   'one', 1, false),
      ('s3f', 'g3', 2, 9100,   2, 1,    'one', 1, false),
      ('s4',  'g4', 2, 9004,  25, 15,   'alt', 1, false),
      ('s4f', 'g4', 2, 9100,   2, 1,    'alt', 1, false),
      ('s5',  'g5', 2, 9005,  25, 15,   'alt', 1, false),
      ('s5f', 'g5', 2, 9100,   2, 1,    'alt', 1, false),
      ('s6',  'g6', 2, 9006,  25, 15,   'alt', 1, false),
      ('s6f', 'g6', 2, 9100,   2, 1,    'alt', 1, false),
      ('sd1', 'gd', 2, 10571,  9, 4,    'alt', 1, false),
      ('sd2', 'gd', 2, 10572,  9, 5,    'alt', 1, false),
      ('sd3', 'gd', 2, 10573,  9, 3,    'alt', 1, false),
      ('f1',  'fx', 2, 9001,  25, 10,   'alt', 1, false),
      ('f2',  'fx', 2, 9002,  25, 10,   'alt', 1, false),
      ('f3',  'fx', 2, 9003,  25, 10,   'alt', 1, false),
      ('f4',  'fx', 2, 9004,  25, 10,   'one', 1, false),
      ('f5',  'fx', 2, 9005,  22, 10,   'alt', 1, false),
      ('f6',  'fx', 2, 10571, 13, 5,    'alt', 1, false),
      ('f7',  'fx', 2, 10573, 12, 6,    'alt', 1, false),
      ('y1',  'fy', 1, 9006,  50, 20,   'alt', 1, false),
      ('y2',  'fy', 1, 9201,  40, 16,   'alt', 1, false),
      ('y3',  'fy', 1, 9202,  40, 16,   'alt', 1, false),
      ('y4',  'fy', 1, 9203,  40, 16,   'alt', 1, false),
      ('y5',  'fy', 1, 9204,  40, 16,   'alt', 1, false),
      ('m1',  'md', 5, 9001,  10, 10,   'alt', 1, false),
      ('m2',  'md', 5, 9103,   5, 3,    'alt', 1, false),
      ('m3',  'md', 5, 9104,   5, 3,    'alt', 1, false),
      ('m4',  'md', 5, 9105,   5, 3,    'alt', 1, false),
      ('u1',  'un', 5, 9001,  10, 10,   'alt', 1, true)
    ) as v(id, prefix, people, hero, rounds, wins, recorders, mode, named_only)
  ) pl
  cross join lateral generate_series(1, pl.people) as i(i)
  cross join lateral generate_series(1, pl.rounds) as r(r);

  answer := public.read_hero_specialists();

  select count(*) into shown from jsonb_array_elements(answer) e where (e ->> 'half_season')::numeric = 993;
  if shown <> 2 then
    raise exception 'exactly heroes 9001 and 1057 must be returned, got %', (
      select jsonb_agg(e -> 'hero_id') from jsonb_array_elements(answer) e where (e ->> 'half_season')::numeric = 993);
  end if;

  select e into row_9001 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer = 9001;
  -- 2 specialists with 25 matches each and 15 wins each, 2 flex people with 25 matches each and 10 wins each: the
  -- smallest buckets that pass. The middle people (all wins), the people with no uid (all wins) and the extra
  -- no-result and Arcade matches (wins) must change nothing.
  if row_9001 is null
     or (row_9001 ->> 'specialist_matches')::integer <> 50 or (row_9001 ->> 'specialist_wins')::integer <> 30
     or (row_9001 ->> 'flex_matches')::integer <> 50 or (row_9001 ->> 'flex_wins')::integer <> 20 then
    raise exception 'hero 9001 is wrong (classification, the excluded middle, uid-less lines or the counted matches): %', row_9001;
  end if;

  -- 1057 only exists as one hero when Deadpool's role forms are merged: 2 specialists with 27 matches each (4 + 5 + 3
  -- wins over forms 10571, 10572 and 10573; no form alone reaches the 10 a specialist needs) and 2 flex people with
  -- 25 each (5 + 6 wins over forms 10571 and 10573).
  select e into row_1057 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer = 1057;
  if row_1057 is null
     or (row_1057 ->> 'specialist_matches')::integer <> 54 or (row_1057 ->> 'specialist_wins')::integer <> 24
     or (row_1057 ->> 'flex_matches')::integer <> 50 or (row_1057 ->> 'flex_wins')::integer <> 22 then
    raise exception 'hero 1057 is wrong (Deadpool''s role forms must count as one hero): %', row_1057;
  end if;

  -- Two people with two recorders and 50 matches are shown (9001 above); one person is not, whichever bucket it
  -- is in, though its bucket has 50 matches and 2 recorders.
  if exists (
    select 1 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer = 9002
  ) then
    raise exception 'hero 9002 has one specialist and must be hidden';
  end if;
  if exists (
    select 1 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer = 9006
  ) then
    raise exception 'hero 9006 has one flex person and must be hidden';
  end if;

  -- 9002, 9003, 9004, 9005 and 9006 each fail exactly one gate (one specialist, one recorder, one recorder, 44
  -- matches, one flex person), and no other hero has both buckets. A hero below a gate is absent: nothing about it
  -- leaves the database.
  if exists (
    select 1 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer not in (9001, 1057)
  ) then
    raise exception 'a hero below a gate, or with one bucket, was returned';
  end if;

  -- Only pooled counts leave: no uid, name, fingerprint, recorder, or number of people.
  select string_agg(distinct k, ',' order by k) into keys
    from jsonb_array_elements(answer) e, jsonb_object_keys(e) k;
  if keys is distinct from 'flex_matches,flex_wins,half_season,hero_id,specialist_matches,specialist_wins' then
    raise exception 'the answer carries a field it must not: %', keys;
  end if;

  if has_function_privilege('anon', 'public.read_hero_specialists()', 'execute')
     or has_function_privilege('authenticated', 'public.read_hero_specialists()', 'execute')
     or not has_function_privilege('service_role', 'public.read_hero_specialists()', 'execute') then
    raise exception 'only the service role may read the specialist counts';
  end if;
end
$$;

rollback;
