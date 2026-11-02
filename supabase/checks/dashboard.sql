-- Checks the rules of the owner-only dashboard read (issue 329): an account receives the lines its
-- own link can prove are its own and no one else's, a second account (linked or not) gets none of the
-- first's, a line with the same uid from another recorder or from the backfill is left out, only a
-- signed-in non-anonymous account may call the function, and the answer is capped.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/dashboard.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  account_c uuid := gen_random_uuid();
  account_d uuid := gen_random_uuid();
  account_e uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  claims_c text;
  claims_d text;
  claims_e text;
  answer jsonb;
  own_line_id bigint;
  hulk_line jsonb;
  blank_line jsonb;
begin
  insert into auth.users (id, email)
  values
    (account_a, 'dashboard-check-a@example.invalid'),
    (account_b, 'dashboard-check-b@example.invalid'),
    (account_c, 'dashboard-check-c@example.invalid'),
    (account_d, 'dashboard-check-d@example.invalid'),
    (account_e, 'dashboard-check-e@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;
  claims_c := json_build_object('sub', account_c, 'role', 'authenticated')::text;
  claims_d := json_build_object('sub', account_d, 'role', 'authenticated')::text;
  claims_e := json_build_object('sub', account_e, 'role', 'authenticated')::text;

  -- A, B, D and E are linked; C is not. D claims A's uid through a recorder of its own, which is all a
  -- link can do: the uid is a claim, the recorder is the proof.
  insert into public.player_links (user_id, recorder_id, player_uid, player_name, avatar_url)
  values
    (account_a, 'dash-rec-a', 'dash-uid-a', 'Aurora', 'https://content.overwolf.com/a.png'),
    (account_b, 'dash-rec-b', 'dash-uid-b', 'Blaze', null),
    (account_d, 'dash-rec-d', 'dash-uid-a', 'Squatter', null),
    (account_e, 'dash-rec-e', 'dash-uid-e', 'Eclipse', null);

  -- A's own three lines (the newest first by time, not by insertion), then every line that must not
  -- reach A: the same uid from another recorder, the same recorder's teammates, and a backfilled line.
  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, deaths, assists, final_hits, is_win,
     play_mode_id, map_name, recorded_by)
  values
    ('dash-m1', 9.0, now() - interval '3 hours', 'dash-uid-a', 'Aurora', 1, 1011, 10, 2, 4, 3, true, 1, 'Tokyo 2099', 'dash-rec-a'),
    ('dash-m2', 9.0, now() - interval '1 hour', 'dash-uid-a', 'Aurora', 1, 1037, 5, 5, 5, null, false, 0, null, 'dash-rec-a'),
    ('dash-m3', 9.0, now() - interval '2 hours', 'dash-uid-a', 'Aurora', 2, 1031, null, null, null, null, null, null, null, 'dash-rec-a'),
    ('dash-m4', 9.0, now() - interval '4 hours', 'dash-uid-teammate', 'Mate', 1, 1011, 99, 0, 99, 99, true, 1, 'Tokyo 2099', 'dash-rec-a'),
    ('dash-m5', 9.0, now() - interval '5 hours', 'dash-uid-a', 'Aurora', 1, 1011, 77, 0, 77, 77, true, 1, 'Tokyo 2099', 'dash-rec-b'),
    ('dash-m6', 9.0, now() - interval '6 hours', 'dash-uid-a', 'Aurora', 1, 1011, 88, 0, 88, 88, true, 1, 'Tokyo 2099', 'backfill-143'),
    ('dash-m7', 9.0, now() - interval '7 hours', 'dash-uid-b', 'Blaze', 1, 1033, 3, 3, 3, null, true, 1, 'Midtown', 'dash-rec-b');

  select id into own_line_id from public.participants where fingerprint = 'dash-m1';
  insert into public.participant_hero_figures (participant_id, hero_id, seconds, damage_dealt, healing, damage_blocked)
  values (own_line_id, 1011, 300, 4500, null, 1200);

  -- Another recorder's figures on a line that is not A's are not A's either.
  insert into public.participant_hero_figures (participant_id, hero_id, seconds, damage_dealt)
  select id, 1011, 60, 1 from public.participants where fingerprint = 'dash-m5';

  -- A signed-in, linked account receives its own lines, newest first, and nothing else.
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;

  answer := public.read_own_dashboard();

  if (answer ->> 'linked')::boolean is distinct from true or answer ->> 'name' <> 'Aurora'
     or answer ->> 'avatarUrl' <> 'https://content.overwolf.com/a.png' then
    raise exception 'check failed: account A did not receive its own link (%)', answer;
  end if;
  if jsonb_array_length(answer -> 'lines') <> 3 then
    raise exception 'check failed: account A received % lines, not its own 3', jsonb_array_length(answer -> 'lines');
  end if;
  if (answer ->> 'truncated')::boolean then
    raise exception 'check failed: three lines were reported as cut off';
  end if;
  if (select array_agg((l ->> 'heroId')::integer order by o)
      from jsonb_array_elements(answer -> 'lines') with ordinality as t(l, o)) is distinct from array[1037, 1031, 1011] then
    raise exception 'check failed: account A''s lines are not newest first (%)', answer -> 'lines';
  end if;
  raise notice 'ok: an account receives its own lines, newest first';

  select l into hulk_line from jsonb_array_elements(answer -> 'lines') l where l ->> 'heroId' = '1011';
  if jsonb_array_length(hulk_line -> 'figures') <> 1
     or hulk_line -> 'figures' -> 0 ->> 'damage' <> '4500'
     or hulk_line -> 'figures' -> 0 ->> 'blocked' <> '1200' then
    raise exception 'check failed: the line''s own figures were not returned (%)', hulk_line;
  end if;
  raise notice 'ok: a line carries its own hero figures';

  -- A blank stays null in the answer; the derivation must never see it as 0.
  select l into blank_line from jsonb_array_elements(answer -> 'lines') l where l ->> 'heroId' = '1031';
  if jsonb_typeof(hulk_line -> 'figures' -> 0 -> 'healing') <> 'null'
     or jsonb_typeof(blank_line -> 'kills') <> 'null'
     or jsonb_typeof(blank_line -> 'isWin') <> 'null'
     or jsonb_typeof(blank_line -> 'finalHits') <> 'null' then
    raise exception 'check failed: a blank value did not come back as null (%, %)', hulk_line, blank_line;
  end if;
  raise notice 'ok: a blank figure is null and never 0';

  if answer::text ~ 'dash-rec|dash-uid|backfill|Mate' then
    raise exception 'check failed: the answer names a recorder, a uid or someone else''s line (%)', answer;
  end if;
  raise notice 'ok: the answer names no recorder, no uid and no one else';

  if exists (select 1 from jsonb_array_elements(answer -> 'lines') l where (l ->> 'kills')::integer in (99, 77, 88)) then
    raise exception 'check failed: account A received a line that is not its own';
  end if;
  raise notice 'ok: another recorder''s line with the same uid, a teammate''s line and a backfilled line are left out';

  -- A second account, linked, receives none of the first's lines even though it claims the same uid.
  perform set_config('request.jwt.claims', claims_d, true);
  answer := public.read_own_dashboard();
  if (answer ->> 'linked')::boolean is distinct from true or jsonb_array_length(answer -> 'lines') <> 0 then
    raise exception 'check failed: an account that claims A''s uid received lines (%)', answer;
  end if;
  raise notice 'ok: claiming another player''s uid reads none of their lines';

  -- Another linked account receives only its own.
  perform set_config('request.jwt.claims', claims_b, true);
  answer := public.read_own_dashboard();
  if jsonb_array_length(answer -> 'lines') <> 1 or (answer -> 'lines' -> 0 ->> 'heroId')::integer <> 1033 then
    raise exception 'check failed: account B did not receive exactly its own line (%)', answer;
  end if;
  if jsonb_array_length(answer -> 'lines' -> 0 -> 'figures') <> 0 then
    raise exception 'check failed: account B received figures from a line that is not its own';
  end if;
  raise notice 'ok: a second linked account receives only its own lines';

  -- An account with no link is told so and receives no lines.
  perform set_config('request.jwt.claims', claims_c, true);
  answer := public.read_own_dashboard();
  if answer <> '{"linked": false}'::jsonb then
    raise exception 'check failed: an unlinked account received more than "not linked" (%)', answer;
  end if;
  raise notice 'ok: an unlinked account receives no lines';

  -- Unlinking ends the read at once.
  reset role;
  delete from public.player_links where user_id = account_b;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  answer := public.read_own_dashboard();
  if answer <> '{"linked": false}'::jsonb then
    raise exception 'check failed: an account that unlinked still read lines (%)', answer;
  end if;
  raise notice 'ok: unlinking stops the read';

  -- The cap: 2,001 lines are reported as cut off at 2,000, and exactly 2,000 are not.
  reset role;
  insert into public.participants (fingerprint, half_season, played_at, uid, name, hero_id, kills, recorded_by)
  select 'dash-cap-' || n, 9.0, now() - make_interval(mins => n), 'dash-uid-e', 'Eclipse', 1011, 1, 'dash-rec-e'
  from generate_series(1, 2001) as n;

  perform set_config('request.jwt.claims', claims_e, true);
  set local role authenticated;
  answer := public.read_own_dashboard();
  if jsonb_array_length(answer -> 'lines') <> 2000 or (answer ->> 'truncated')::boolean is distinct from true then
    raise exception 'check failed: 2,001 lines gave % lines and truncated %', jsonb_array_length(answer -> 'lines'), answer ->> 'truncated';
  end if;
  if (answer -> 'lines' -> 0 ->> 'playedAt')::timestamptz < (answer -> 'lines' -> 1999 ->> 'playedAt')::timestamptz then
    raise exception 'check failed: the cap kept the oldest lines';
  end if;

  reset role;
  delete from public.participants where fingerprint = 'dash-cap-2001';
  perform set_config('request.jwt.claims', claims_e, true);
  set local role authenticated;
  answer := public.read_own_dashboard();
  if jsonb_array_length(answer -> 'lines') <> 2000 or (answer ->> 'truncated')::boolean is distinct from false then
    raise exception 'check failed: exactly 2,000 lines gave % lines and truncated %', jsonb_array_length(answer -> 'lines'), answer ->> 'truncated';
  end if;
  raise notice 'ok: the lines are capped at 2,000, newest kept, and the cut is reported';

  -- Who may call it: not anon, not the service role, not a caller with no account, not an anonymous session.
  reset role;
  set local role anon;

  begin
    perform public.read_own_dashboard();
    raise exception 'check failed: an anonymous caller read a dashboard';
  exception when insufficient_privilege then
    raise notice 'ok: the anon role cannot read a dashboard';
  end;

  reset role;
  set local role service_role;

  begin
    perform public.read_own_dashboard();
    raise exception 'check failed: the service role read a dashboard';
  exception when insufficient_privilege then
    raise notice 'ok: the service role cannot read a dashboard';
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
  set local role authenticated;

  begin
    perform public.read_own_dashboard();
    raise exception 'check failed: a caller with no account read a dashboard';
  exception when invalid_authorization_specification then
    raise notice 'ok: a caller with no account cannot read a dashboard';
  end;

  perform set_config('request.jwt.claims',
    json_build_object('sub', account_a, 'role', 'authenticated', 'is_anonymous', true)::text, true);

  begin
    perform public.read_own_dashboard();
    raise exception 'check failed: an anonymous session read a dashboard';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous session cannot read a dashboard';
  end;

  -- The table stays closed: a signed-in client cannot read the lines directly.
  perform set_config('request.jwt.claims', claims_a, true);

  begin
    perform 1 from public.participants limit 1;
    raise exception 'check failed: a signed-in client read participants directly';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in client cannot read participants directly';
  end;

  begin
    perform 1 from public.participant_hero_figures limit 1;
    raise exception 'check failed: a signed-in client read hero figures directly';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in client cannot read hero figures directly';
  end;
end
$$;

rollback;
