-- Checks the hero XP freeze of 20261115100000_hero_xp_carry_overs.sql (issue 868): the purge works out the XP of
-- the matches it deletes with the same rules as `src/server/hero-progress/`, keeps only an account's per-hero totals
-- and the two times its bonus chains stood at, freezes before it deletes in the one transaction, and the owner's read
-- hands back the totals beside the matches still held. It changes nothing (it ends in a rollback), although it runs the
-- real `purge_expired_participants()` inside the transaction, so it also freezes and deletes whatever real rows are due,
-- for as long as the transaction lasts.
--
-- Run it against the project after the migration is applied:
--   npx supabase db query --linked -f supabase/checks/hero_xp_carry_overs.sql
-- It prints a notice per passing check and raises an exception at the first failure. Read its output for "_tag":"Error"
-- as well as the exit code: a failed run can still exit 0.
--
-- THE FIXTURE below is the contract between the two implementations of the rules. This script holds the SQL to its
-- `expected` block, and `scripts/hero-xp-carry.test.ts` holds the TypeScript to the very same text, so the two cannot
-- drift apart without one of them failing. Times are in milliseconds from the cut-off the purge uses for its six-month
-- rule (`now() - interval '6 months'`): a match before it is deleted and frozen, a match at it or after is kept. The
-- Season 11 trigger `normalize_match_half_season` rewrites a line's half-season from its end time, so the script gives
-- the lines two half-seasons of its own (900.0 and 901.0), starting long before any real one, and fails if the
-- trigger ever stores a different one. The expected totals are kept in the fixture, never computed here.

begin;

do $$
declare
  fixture jsonb := $fixture$
{
  "matches": [
    {"key": "9000000001", "offsetMs": -4320000000, "halfSeason": 900, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "the first match there is: a first win, no rested bonus"},
    {"key": "9000000002", "offsetMs": -4316400000, "halfSeason": 900, "playModeId": 0, "isWin": false, "heroId": null, "figures": [{"heroId": 1011, "seconds": 240, "damage": null, "healing": null, "blocked": null}, {"heroId": 1031, "seconds": 360, "damage": null, "healing": null, "blocked": null}], "note": "a hero swap: both heroes get the match, each its own minutes"},
    {"key": "9000000003", "offsetMs": -4314600000, "halfSeason": 900, "playModeId": 3, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "Practice never counts and never moves the chains"},
    {"key": "9000000004", "offsetMs": -4309200000, "halfSeason": 900, "playModeId": 0, "isWin": true, "heroId": 1034, "figures": [], "note": "no figures: the hero on the line gets the match with no minutes; exactly 2 hours after the last counted match, so rested"},
    {"key": "9000000005", "offsetMs": -172800000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 2400, "damage": null, "healing": null, "blocked": null}, {"heroId": 1018, "seconds": 29, "damage": 5, "healing": null, "blocked": null}, {"heroId": 1031, "seconds": 29, "damage": null, "healing": null, "blocked": null}], "note": "minutes cap at 30; 29 seconds counts with damage and not without"},
    {"key": "9000000010", "offsetMs": -97200000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1034, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "tied with the next match on end time; the ids read as text, not as numbers, put this one first, so it earns the first win and rested"},
    {"key": "900000009", "offsetMs": -97200000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "the other half of the tie: it follows the first, so no bonus"},
    {"key": "9000000011", "offsetMs": -25200001, "halfSeason": 901, "playModeId": 0, "isWin": true, "heroId": null, "figures": [{"heroId": 1031, "seconds": 300, "damage": null, "healing": null, "blocked": null}], "note": "1 millisecond short of 20 hours after the last first win: no first win, but rested"},
    {"key": "9000000012", "offsetMs": -25200000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 60, "damage": null, "healing": null, "blocked": null}], "note": "exactly 20 hours after the last first win: a first win, not rested"},
    {"key": "9000000013", "offsetMs": -7200000, "halfSeason": 901, "playModeId": 0, "isWin": null, "heroId": null, "figures": [], "note": "no result, no figures and no hero: counts in the chain and credits nobody"},
    {"key": "9000000014", "offsetMs": -3600000, "halfSeason": 901, "playModeId": 1, "isWin": false, "heroId": null, "figures": [{"heroId": 1018, "seconds": 31, "damage": null, "healing": null, "blocked": null}], "note": "the last match the purge deletes"},
    {"key": "9000000015", "offsetMs": 0, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "the first match held: 1 hour after the last frozen one, 7 hours after the last first win, so no bonus at all"},
    {"key": "9000000016", "offsetMs": 7199999, "halfSeason": 901, "playModeId": 1, "isWin": false, "heroId": null, "figures": [{"heroId": 1031, "seconds": 120, "damage": null, "healing": null, "blocked": null}], "note": "1 millisecond short of rested"},
    {"key": "9000000017", "offsetMs": 14399999, "halfSeason": 901, "playModeId": 0, "isWin": false, "heroId": null, "figures": [{"heroId": 1018, "seconds": 300, "damage": null, "healing": null, "blocked": null}], "note": "exactly 2 hours after the previous counted match: rested"},
    {"key": "9000000018", "offsetMs": 21600000, "halfSeason": 901, "playModeId": 2, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "Arcade never counts"},
    {"key": "9000000019", "offsetMs": 46799999, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "1 millisecond short of 20 hours after the first win the purge froze: rested only"},
    {"key": "9000000020", "offsetMs": 46800000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1034, "seconds": 600, "damage": null, "healing": null, "blocked": null}, {"heroId": 1011, "seconds": 600, "damage": null, "healing": null, "blocked": null}], "note": "exactly 20 hours after it: the first win carries on across the purge"},
    {"key": "9000000021", "offsetMs": 144000000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": null, "figures": [{"heroId": 1011, "seconds": 4000, "damage": null, "healing": null, "blocked": null}], "note": "a long gap: both bonuses again"},
    {"key": "9000000022", "offsetMs": 147600000, "halfSeason": 901, "playModeId": 1, "isWin": true, "heroId": 1034, "figures": [], "note": "no figures, held: the hero on the line"}
  ],
  "expected": {
    "carryOvers": [
      {"halfSeason": 900, "heroId": 1011, "baseXp": 250, "timeXp": 140, "bonusXp": 150},
      {"halfSeason": 900, "heroId": 1031, "baseXp": 100, "timeXp": 60, "bonusXp": 0},
      {"halfSeason": 900, "heroId": 1034, "baseXp": 150, "timeXp": 0, "bonusXp": 100},
      {"halfSeason": 901, "heroId": 1011, "baseXp": 450, "timeXp": 410, "bonusXp": 400},
      {"halfSeason": 901, "heroId": 1018, "baseXp": 250, "timeXp": 0, "bonusXp": 250},
      {"halfSeason": 901, "heroId": 1031, "baseXp": 150, "timeXp": 50, "bonusXp": 100},
      {"halfSeason": 901, "heroId": 1034, "baseXp": 150, "timeXp": 100, "bonusXp": 250}
    ],
    "lastBonusWinOffsetMs": -25200000,
    "lastCountedOffsetMs": -3600000,
    "allTimeXpByHeroId": {"1011": 3500, "1018": 750, "1031": 580, "1034": 1300}
  }
}
  $fixture$::jsonb;
  cutoff timestamptz := now() - interval '6 months';
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  account_c uuid := gen_random_uuid();
  account_d uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  claims_c text;
  claims_d text;
  line jsonb;
  figure jsonb;
  expected jsonb := fixture -> 'expected';
  kept_keys text[];
  answer jsonb;
  mismatches integer;
  before_total bigint;
  purge_definition text;
begin
  insert into auth.users (id, email)
  values
    (account_a, 'xp-check-a@example.invalid'),
    (account_b, 'xp-check-b@example.invalid'),
    (account_c, 'xp-check-c@example.invalid'),
    (account_d, 'xp-check-d@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;
  claims_c := json_build_object('sub', account_c, 'role', 'authenticated')::text;
  claims_d := json_build_object('sub', account_d, 'role', 'authenticated')::text;

  -- Two half-seasons of the script's own, long before any real one.
  insert into public.half_seasons (half_season, starts_at)
  values (900.0, cutoff - interval '60 days'), (901.0, cutoff - interval '40 days');

  -- A, B and C are linked; D is not. C has no line, so nothing is frozen for it.
  insert into public.player_links (user_id, recorder_id, player_uid, player_name)
  values
    (account_a, 'xp-rec-a', 'xp-uid-a', 'Xavier'),
    (account_b, 'xp-rec-b', 'xp-uid-b', 'Xena'),
    (account_c, 'xp-rec-c', 'xp-uid-c', 'Xiu');

  -- A's own lines, exactly as the fixture says.
  for line in select l from jsonb_array_elements(fixture -> 'matches') l loop
    insert into public.participants
      (id, fingerprint, half_season, played_at, uid, name, team, hero_id, is_win, play_mode_id, recorded_by)
    values
      ((line ->> 'key')::bigint, 'xp-m-' || (line ->> 'key'), (line ->> 'halfSeason')::numeric,
       cutoff + (line ->> 'offsetMs')::bigint * interval '1 millisecond', 'xp-uid-a', 'Xavier', 1,
       (line ->> 'heroId')::integer, (line ->> 'isWin')::boolean, (line ->> 'playModeId')::smallint, 'xp-rec-a');

    for figure in select f from jsonb_array_elements(line -> 'figures') f loop
      insert into public.participant_hero_figures (participant_id, hero_id, seconds, damage_dealt, healing, damage_blocked)
      values ((line ->> 'key')::bigint, (figure ->> 'heroId')::integer, (figure ->> 'seconds')::integer,
              (figure ->> 'damage')::integer, (figure ->> 'healing')::integer, (figure ->> 'blocked')::integer);
    end loop;
  end loop;

  if exists (
    select 1 from public.participants p
    join jsonb_array_elements(fixture -> 'matches') l on p.id = (l ->> 'key')::bigint
    where p.half_season <> (l ->> 'halfSeason')::numeric
  ) then
    raise exception 'check failed: the half-season trigger stored a half-season the fixture does not name; give the script half-seasons that no real one overlaps';
  end if;

  -- Lines that must not reach A's totals although they are past retention: the same uid from another recorder and
  -- the same recorder's teammate. Then B's own line, and a player with no link at all.
  insert into public.participants
    (id, fingerprint, half_season, played_at, uid, name, team, hero_id, is_win, play_mode_id, recorded_by)
  values
    (9100000001, 'xp-d1', 901.0, cutoff - interval '5 days', 'xp-uid-a', 'Xavier', 1, 1011, true, 1, 'xp-rec-other'),
    (9100000002, 'xp-d2', 901.0, cutoff - interval '5 days', 'xp-uid-mate', 'Mate', 1, 1011, true, 1, 'xp-rec-a'),
    (9100000003, 'xp-b1', 901.0, cutoff - interval '10 days', 'xp-uid-b', 'Xena', 1, null, false, 1, 'xp-rec-b'),
    (9100000004, 'xp-z1', 901.0, cutoff - interval '10 days', 'xp-uid-z', 'Zed', 1, 1011, true, 1, 'xp-rec-z');
  insert into public.participant_hero_figures (participant_id, hero_id, seconds)
  values (9100000001, 1011, 900), (9100000002, 1011, 900), (9100000003, 1031, 90), (9100000004, 1011, 900);

  select count(*) into mismatches from public.participants where recorded_by = 'xp-rec-a' and uid = 'xp-uid-a';
  if mismatches <> jsonb_array_length(fixture -> 'matches') then
    raise exception 'check failed: the fixture was written as % lines, not %', mismatches, jsonb_array_length(fixture -> 'matches');
  end if;

  -- The purge freezes before it deletes: the call is ahead of the first delete in the function the database holds.
  purge_definition := pg_get_functiondef('public.purge_expired_participants'::regproc);
  if position('freeze_hero_xp_carry_overs' in purge_definition) = 0
     or position('freeze_hero_xp_carry_overs' in purge_definition) > position('delete from public.participants' in purge_definition) then
    raise exception 'check failed: the purge does not call freeze_hero_xp_carry_overs before it deletes the scoreboard';
  end if;
  raise notice 'ok: the purge freezes the hero XP before its first delete';

  -- The real purge, once, in this transaction.
  perform public.purge_expired_participants();

  if exists (select 1 from public.participants where played_at < cutoff and recorded_by in ('xp-rec-a', 'xp-rec-b', 'xp-rec-z', 'xp-rec-other')) then
    raise exception 'check failed: the purge left a line past retention behind';
  end if;
  select array_agg(p.id::text order by p.played_at, p.id) into kept_keys
  from public.participants p where p.recorded_by = 'xp-rec-a' and p.uid = 'xp-uid-a';
  if kept_keys is distinct from (
    select array_agg(l ->> 'key' order by (l ->> 'offsetMs')::bigint)
    from jsonb_array_elements(fixture -> 'matches') l where (l ->> 'offsetMs')::bigint >= 0
  ) then
    raise exception 'check failed: the purge did not keep exactly the matches at or after the cut-off (%)', kept_keys;
  end if;
  if exists (
    select 1 from public.participant_hero_figures f
    join jsonb_array_elements(fixture -> 'matches') l on f.participant_id = (l ->> 'key')::bigint
    where (l ->> 'offsetMs')::bigint < 0
  ) then
    raise exception 'check failed: the figures of a deleted line were left behind';
  end if;
  raise notice 'ok: the purge deleted the lines past retention and kept the others';

  -- A's frozen totals are exactly the fixture's: every half-season and hero, and nothing else.
  select count(*) into mismatches
  from jsonb_to_recordset(expected -> 'carryOvers') as e("halfSeason" numeric, "heroId" integer, "baseXp" integer, "timeXp" integer, "bonusXp" integer)
  full join public.hero_xp_carry_overs o
    on o.user_id = account_a and o.half_season = e."halfSeason" and o.hero_id = e."heroId"
   and o.base_xp = e."baseXp" and o.time_xp = e."timeXp" and o.bonus_xp = e."bonusXp"
  where (o.user_id is null or e."heroId" is null) and (e."heroId" is not null or o.user_id = account_a);
  if mismatches <> 0 then
    raise exception 'check failed: % frozen totals of account A differ from the fixture (%)', mismatches,
      (select jsonb_agg(to_jsonb(o) - 'user_id' order by o.half_season, o.hero_id) from public.hero_xp_carry_overs o where o.user_id = account_a);
  end if;
  raise notice 'ok: the SQL freezes the totals the fixture names, bonuses and all';

  if (select c.last_bonus_win_at from public.hero_xp_carry_chains c where c.user_id = account_a)
       is distinct from cutoff + (expected ->> 'lastBonusWinOffsetMs')::bigint * interval '1 millisecond'
     or (select c.last_counted_at from public.hero_xp_carry_chains c where c.user_id = account_a)
       is distinct from cutoff + (expected ->> 'lastCountedOffsetMs')::bigint * interval '1 millisecond' then
    raise exception 'check failed: the frozen chains of account A are not where the fixture leaves them (%)',
      (select to_jsonb(c) from public.hero_xp_carry_chains c where c.user_id = account_a);
  end if;
  raise notice 'ok: the last first win and the last counted match are kept for the chains to continue from';

  -- Another recorder's line with A's uid, a teammate's line and an unlinked player's line reach nobody; B gets its own.
  if exists (select 1 from public.hero_xp_carry_overs o where o.user_id not in (account_a, account_b)) then
    raise exception 'check failed: totals were frozen for an account that had no line';
  end if;
  if (select jsonb_agg(jsonb_build_object('h', o.half_season, 'i', o.hero_id, 'b', o.base_xp, 't', o.time_xp, 'x', o.bonus_xp))
      from public.hero_xp_carry_overs o where o.user_id = account_b)
     is distinct from jsonb_build_array(jsonb_build_object('h', 901.0, 'i', 1031, 'b', 100, 't', 10, 'x', 0))
     or (select to_jsonb(c) - 'user_id' from public.hero_xp_carry_chains c where c.user_id = account_b)
        is distinct from jsonb_build_object('last_bonus_win_at', null, 'last_counted_at', cutoff - interval '10 days') then
    raise exception 'check failed: account B did not freeze exactly its own line';
  end if;
  raise notice 'ok: only an account''s own lines are frozen for it, and an account with none has nothing';

  -- Only the account and per-hero totals are kept; the tables are closed to everyone but the service role.
  if (select array_agg(column_name::text order by column_name) from information_schema.columns
      where table_schema = 'public' and table_name = 'hero_xp_carry_overs')
       is distinct from array['base_xp', 'bonus_xp', 'half_season', 'hero_id', 'time_xp', 'user_id']
     or (select array_agg(column_name::text order by column_name) from information_schema.columns
         where table_schema = 'public' and table_name = 'hero_xp_carry_chains')
       is distinct from array['last_bonus_win_at', 'last_counted_at', 'user_id'] then
    raise exception 'check failed: the carry-over tables hold more than the account and per-hero totals';
  end if;
  if has_table_privilege('authenticated', 'public.hero_xp_carry_overs', 'select')
     or has_table_privilege('anon', 'public.hero_xp_carry_overs', 'select')
     or has_table_privilege('authenticated', 'public.hero_xp_carry_chains', 'select')
     or has_table_privilege('anon', 'public.hero_xp_carry_chains', 'select')
     or not (select relrowsecurity from pg_class where oid = 'public.hero_xp_carry_overs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.hero_xp_carry_chains'::regclass) then
    raise exception 'check failed: the carry-over tables are open to a client';
  end if;
  if has_function_privilege('anon', 'public.read_own_hero_progress_matches()', 'execute')
     or has_function_privilege('anon', 'public.freeze_hero_xp_carry_overs()', 'execute')
     or has_function_privilege('authenticated', 'public.freeze_hero_xp_carry_overs()', 'execute')
     or not has_function_privilege('authenticated', 'public.read_own_hero_progress_matches()', 'execute') then
    raise exception 'check failed: a function is callable by someone it should not be, or not by the owner';
  end if;
  raise notice 'ok: no name, uid, recorder or match is kept, and only the service role reaches the tables';

  -- Freezing again, with nothing left past retention, adds nothing.
  select sum(base_xp + time_xp + bonus_xp) into before_total from public.hero_xp_carry_overs where user_id = account_a;
  perform public.freeze_hero_xp_carry_overs();
  if (select sum(base_xp + time_xp + bonus_xp) from public.hero_xp_carry_overs where user_id = account_a) <> before_total then
    raise exception 'check failed: freezing a second time counted a match twice';
  end if;
  raise notice 'ok: a second freeze counts nothing twice';

  -- The owner's read: the totals, the chains and only the matches still held.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  answer := public.read_own_hero_progress_matches();
  reset role;

  if (answer -> 'carry' -> 'heroes') is distinct from (expected -> 'carryOvers')
     or (answer -> 'carry' ->> 'lastBonusWinAt')::timestamptz
          is distinct from cutoff + (expected ->> 'lastBonusWinOffsetMs')::bigint * interval '1 millisecond'
     or (answer -> 'carry' ->> 'lastCountedAt')::timestamptz
          is distinct from cutoff + (expected ->> 'lastCountedOffsetMs')::bigint * interval '1 millisecond' then
    raise exception 'check failed: the read did not hand back the frozen totals (%)', answer -> 'carry';
  end if;
  if (select array_agg(m ->> 'matchKey' order by ord) from jsonb_array_elements(answer -> 'matches') with ordinality as t(m, ord))
       is distinct from kept_keys then
    raise exception 'check failed: the read did not hand back exactly the matches still held (%)', answer -> 'matches';
  end if;
  if answer::text ~ 'xp-rec|xp-uid|Xavier|xp-m-' then
    raise exception 'check failed: the answer names a recorder, a uid, a name or a roster (%)', answer;
  end if;
  raise notice 'ok: the owner receives the frozen totals and the matches still held, and nothing that names anyone';

  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  answer := public.read_own_hero_progress_matches();
  reset role;
  if jsonb_array_length(answer -> 'carry' -> 'heroes') <> 1 or (answer -> 'carry' -> 'heroes' -> 0 ->> 'heroId') <> '1031' then
    raise exception 'check failed: account B did not receive exactly its own totals (%)', answer -> 'carry';
  end if;

  perform set_config('request.jwt.claims', claims_c, true);
  set local role authenticated;
  answer := public.read_own_hero_progress_matches();
  reset role;
  if answer -> 'carry' -> 'heroes' <> '[]'::jsonb or jsonb_typeof(answer -> 'carry' -> 'lastCountedAt') <> 'null'
     or jsonb_array_length(answer -> 'matches') <> 0 then
    raise exception 'check failed: a linked account with nothing frozen did not get an empty carry (%)', answer;
  end if;

  perform set_config('request.jwt.claims', claims_d, true);
  set local role authenticated;
  answer := public.read_own_hero_progress_matches();
  reset role;
  if answer is distinct from jsonb_build_object('linked', false) then
    raise exception 'check failed: an account with no link received something (%)', answer;
  end if;
  raise notice 'ok: each account reads only its own totals, and no link reads none';

  -- A line that reaches the purge after the chains moved past it counts its base and time XP, and the chains never move back.
  insert into public.participants
    (id, fingerprint, half_season, played_at, uid, name, team, hero_id, is_win, play_mode_id, recorded_by)
  values (9100000010, 'xp-late', 900.0, cutoff - interval '45 days', 'xp-uid-a', 'Xavier', 1, 1011, true, 1, 'xp-rec-a');
  insert into public.participant_hero_figures (participant_id, hero_id, seconds) values (9100000010, 1011, 120);
  perform public.freeze_hero_xp_carry_overs();
  if (select o.base_xp * 1000000 + o.time_xp * 1000 + o.bonus_xp from public.hero_xp_carry_overs o
      where o.user_id = account_a and o.half_season = 900.0 and o.hero_id = 1011)
       is distinct from (250 + 150) * 1000000 + (140 + 20) * 1000 + 150
     or (select c.last_counted_at from public.hero_xp_carry_chains c where c.user_id = account_a)
          is distinct from cutoff + (expected ->> 'lastCountedOffsetMs')::bigint * interval '1 millisecond'
     or (select c.last_bonus_win_at from public.hero_xp_carry_chains c where c.user_id = account_a)
          is distinct from cutoff + (expected ->> 'lastBonusWinOffsetMs')::bigint * interval '1 millisecond' then
    raise exception 'check failed: a late match did not count its base and time XP with the chains left where they were';
  end if;
  raise notice 'ok: a late match is counted and never moves the chains back';

  -- Unlinking (the link row going) takes the frozen totals with it, and so does forgetting the player.
  delete from public.player_links where user_id = account_b;
  if exists (select 1 from public.hero_xp_carry_overs where user_id = account_b)
     or exists (select 1 from public.hero_xp_carry_chains where user_id = account_b) then
    raise exception 'check failed: unlinking left frozen totals behind';
  end if;
  perform public.forget_player('xp-uid-a', null);
  if exists (select 1 from public.hero_xp_carry_overs where user_id = account_a)
     or exists (select 1 from public.hero_xp_carry_chains where user_id = account_a) then
    raise exception 'check failed: forgetting a player left their frozen totals behind';
  end if;
  raise notice 'ok: unlinking and forgetting a player delete the frozen totals';
end
$$;

rollback;
