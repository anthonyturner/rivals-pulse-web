-- Proves the specialist and flex rules of 20261111120000_hero_specialists.sql (issue 819) on fixture matches in a
-- half-season that does not exist, then rolls everything back. Run it after the migration is applied:
--   npx supabase db query --linked -f supabase/checks/hero_specialists.sql
-- It fails with an exception naming the rule that broke; it ends with a rollback, never a commit.
--
-- The fixture is a list of plans. A plan is a group of people who each play `rounds` matches on one hero; round r
-- of a plan is one match holding every person's line, so a match is one recorder's upload. A person wins the
-- rounds up to `wins`. Everything is sized for the shipped rules (5 people, 2 recorders, 50 matches per bucket;
-- 50 percent and 10 matches to specialise; under 25 percent over 5 heroes and 20 matches to flex), so changing a
-- rule needs the fixture changed with it.
--
-- Hero 9001 passes: 5 specialists (30 of 50 won) and 5 flex people (20 of 50 won). The four near misses each fail
-- one gate: 9002 has 4 specialists, 9003 has one recorder behind its specialists, 9004 one behind its flex
-- people, 9005 only 45 flex matches. Hero 1057 is Deadpool, whose specialists played 6 matches each on two role
-- forms: only the merged 12 make them specialists, and the flex people's 5 and 5 make 10. The other people must
-- change nothing: 5 "middle" people (40 percent on 9001, neither specialist nor flex, all wins), 5 people with no
-- uid (a specialist's record by name, all wins), and a specialist's extra matches with no result or in Arcade (all
-- wins).
begin;

do $$
declare
  answer jsonb;
  row_9001 jsonb;
  row_1057 jsonb;
  shown integer;
  keys text;
begin
  if exists (select 1 from public.participants where half_season = 993) then
    raise exception 'test half-season already exists';
  end if;
  if (select count(*) from public.hero_game_roles where game_id in (10571, 10572, 10573) and base_game_id = 1057) <> 3 then
    raise exception 'this check needs the three Deadpool role forms in hero_game_roles';
  end if;
  if public.hero_specialist_min_share_percent() <> 50 or public.hero_specialist_min_hero_matches() <> 10
     or public.hero_flex_max_top_share_percent() <> 25 or public.hero_flex_min_heroes() <> 5
     or public.hero_flex_min_matches() <> 20 or public.hero_specialist_min_players() <> 5
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
      ('s1',  'g1', 5, 9001,  10, 6,    'alt', 1, false),
      ('s1n', 'g1', 1, 9001,   5, null, 'alt', 1, false),
      ('s1m', 'g1', 1, 9001,   5, 5,    'alt', 2, false),
      ('s1f', 'g1', 5, 9100,   2, 1,    'alt', 1, false),
      ('s2',  'g2', 4, 9002,  13, 7,    'alt', 1, false),
      ('s2f', 'g2', 4, 9100,   2, 1,    'alt', 1, false),
      ('s3',  'g3', 5, 9003,  10, 6,    'one', 1, false),
      ('s3f', 'g3', 5, 9100,   2, 1,    'one', 1, false),
      ('s4',  'g4', 5, 9004,  10, 6,    'alt', 1, false),
      ('s4f', 'g4', 5, 9100,   2, 1,    'alt', 1, false),
      ('s5',  'g5', 5, 9005,  10, 6,    'alt', 1, false),
      ('s5f', 'g5', 5, 9100,   2, 1,    'alt', 1, false),
      ('sd1', 'gd', 5, 10571,  6, 3,    'alt', 1, false),
      ('sd2', 'gd', 5, 10572,  6, 4,    'alt', 1, false),
      ('f1',  'fx', 5, 9001,  10, 4,    'alt', 1, false),
      ('f2',  'fx', 5, 9002,  10, 4,    'alt', 1, false),
      ('f3',  'fx', 5, 9003,  10, 4,    'alt', 1, false),
      ('f4',  'fx', 5, 9004,  10, 4,    'one', 1, false),
      ('f5',  'fx', 5, 9005,   9, 4,    'alt', 1, false),
      ('f6',  'fx', 5, 10571,  5, 2,    'alt', 1, false),
      ('f7',  'fx', 5, 10573,  5, 3,    'alt', 1, false),
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
  -- 5 specialists with 10 matches each and 6 wins each. The middle people (all wins), the people with no uid (all
  -- wins), the extra no-result and Arcade matches (wins) and the flex people (4 wins each) must change nothing.
  if row_9001 is null
     or (row_9001 ->> 'specialist_matches')::integer <> 50 or (row_9001 ->> 'specialist_wins')::integer <> 30
     or (row_9001 ->> 'flex_matches')::integer <> 50 or (row_9001 ->> 'flex_wins')::integer <> 20 then
    raise exception 'hero 9001 is wrong (classification, the excluded middle, uid-less lines or the counted matches): %', row_9001;
  end if;

  -- 1057 only exists as one hero when Deadpool's role forms are merged: 5 specialists with 12 matches (3 + 4 wins
  -- per form) and 5 flex people with 10 (2 + 3 wins), on forms 10571 and 10572, and 10571 and 10573.
  select e into row_1057 from jsonb_array_elements(answer) e
    where (e ->> 'half_season')::numeric = 993 and (e ->> 'hero_id')::integer = 1057;
  if row_1057 is null
     or (row_1057 ->> 'specialist_matches')::integer <> 60 or (row_1057 ->> 'specialist_wins')::integer <> 35
     or (row_1057 ->> 'flex_matches')::integer <> 50 or (row_1057 ->> 'flex_wins')::integer <> 25 then
    raise exception 'hero 1057 is wrong (Deadpool''s role forms must count as one hero): %', row_1057;
  end if;

  -- 9002, 9003, 9004 and 9005 each fail exactly one gate (4 people, one recorder, one recorder, 45 matches), and
  -- no other hero has both buckets. A hero below a gate is absent: nothing about it leaves the database.
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
