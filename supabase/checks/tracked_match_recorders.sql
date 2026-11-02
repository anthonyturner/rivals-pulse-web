-- Checks the rules of public.tracked_match_recorders (issue 328): clients can read no side rows,
-- the recorder never reaches the publicly readable tracked_matches, and deleting a tracked match
-- (which is how pruning removes one) or its player deletes the side row.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/tracked_match_recorders.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  test_player bigint;
  test_match bigint;
  seen integer;
begin
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('gep', 'recorders-check', 'recorders-check', 'recorders-check')
  returning id into test_player;

  insert into public.tracked_matches (player_id, provider, match_uid)
  values (test_player, 'gep', 'recorders-check-match')
  returning id into test_match;

  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  values (test_match, 'recorders-check-hash');

  set local role anon;
  begin
    perform 1 from public.tracked_match_recorders limit 1;
    raise exception 'check failed: an anonymous caller can read recorder rows';
  exception when insufficient_privilege then
    raise notice 'ok: an anonymous caller reads no recorder rows';
  end;

  reset role;
  set local role authenticated;
  begin
    perform 1 from public.tracked_match_recorders limit 1;
    raise exception 'check failed: a signed-in caller can read recorder rows';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in caller reads no recorder rows';
  end;

  begin
    insert into public.tracked_match_recorders (tracked_match_id, recorded_by) values (test_match, 'x');
    raise exception 'check failed: a signed-in caller can write recorder rows';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in caller writes no recorder rows';
  end;

  reset role;
  select count(*) into seen
  from information_schema.columns
  where table_schema = 'public' and table_name = 'tracked_matches' and column_name = 'recorded_by';
  if seen <> 0 then
    raise exception 'check failed: tracked_matches gained a recorded_by column';
  end if;
  raise notice 'ok: tracked_matches has no recorded_by column';

  delete from public.tracked_matches where id = test_match;
  select count(*) into seen from public.tracked_match_recorders where tracked_match_id = test_match;
  if seen <> 0 then
    raise exception 'check failed: deleting a tracked match left its recorder row';
  end if;
  raise notice 'ok: deleting a tracked match deletes its recorder row';

  insert into public.tracked_matches (player_id, provider, match_uid)
  values (test_player, 'gep', 'recorders-check-match-2')
  returning id into test_match;
  insert into public.tracked_match_recorders (tracked_match_id, recorded_by)
  values (test_match, 'recorders-check-hash');

  delete from public.players where id = test_player;
  select count(*) into seen from public.tracked_match_recorders where tracked_match_id = test_match;
  if seen <> 0 then
    raise exception 'check failed: deleting the player left a recorder row';
  end if;
  raise notice 'ok: deleting the player deletes the recorder row';
end
$$;

rollback;
