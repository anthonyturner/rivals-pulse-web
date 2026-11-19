-- Checks the Pulse Records read (issue 566, ADR-0004): which lines it names, which it leaves off, the
-- forgery guards, the ordering rules, and who may call it. Everything is planted inside one
-- transaction that ends in a rollback, with throwaway accounts, uploaders and hero ids from 9001 up
-- (the game has none that high), so the real boards are never touched and a real line cannot hide a
-- planted one. The assertions read only the planted heroes.
--
-- Run it against the project after the migrations are applied; it changes nothing:
--   npx supabase db query --linked -f supabase/checks/pulse_records.sql
-- Judge it by its exit status. Every failure is an exception ("check failed: ...") that stops the
-- script with a non-zero exit; the notices are for reading, and the last one is reached only when
-- nothing raised.

begin;

-- What each board holds, planted heroes only, as hero:value:name in board order. It lives in the
-- throwaway session schema and goes with the rollback.
create function pg_temp.planted_boards(answer jsonb) returns jsonb
language sql
as $fn$
  select jsonb_object_agg(c ->> 'key', (
    select coalesce(jsonb_agg(concat_ws(':', r ->> 'heroId', r ->> 'value', coalesce(r ->> 'name', '-')) order by o), '[]'::jsonb)
    from jsonb_array_elements(c -> 'rows') with ordinality as t(r, o)
    where (r ->> 'heroId')::integer between 9000 and 9499))
  from jsonb_array_elements(answer -> 'categories') c
$fn$;

do $$
declare
  account_a uuid := gen_random_uuid();
  account_b uuid := gen_random_uuid();
  account_d uuid := gen_random_uuid();
  account_e uuid := gen_random_uuid();
  account_f uuid := gen_random_uuid();
  account_g uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  answer jsonb;
  boards jsonb;
  allowed_keys constant text[] := array['coveredFrom', 'categories', 'key', 'rows', 'heroId', 'value', 'name'];
  found_keys text[];
  hidden_id bigint;
begin
  insert into auth.users (id, email)
  values
    (account_a, 'records-check-a@example.invalid'),
    (account_b, 'records-check-b@example.invalid'),
    (account_d, 'records-check-d@example.invalid'),
    (account_e, 'records-check-e@example.invalid'),
    (account_f, 'records-check-f@example.invalid'),
    (account_g, 'records-check-g@example.invalid');

  claims_a := json_build_object('sub', account_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', account_b, 'role', 'authenticated')::text;

  -- A, E and F switched naming on; B switched it off; D never touched it (no row, so off). F's
  -- link name is nothing but invisible characters, so F is left off every board (a linked line is named or
  -- absent, never anonymous). G opted in too, but G's link name is on do_not_store.
  insert into public.player_links (user_id, recorder_id, player_uid, player_name)
  values
    (account_a, 'chk-rec-a', 'chk-uid-a', 'Aurora' || chr(8238) || chr(8203) || 'Prime'),
    (account_b, 'chk-rec-b', 'chk-uid-b', 'Blaze'),
    (account_d, 'chk-rec-d', 'chk-uid-dflt', 'Default'),
    (account_e, 'chk-rec-e', 'chk-uid-e', 'Eclipse'),
    (account_f, 'chk-rec-f', 'chk-uid-f', chr(8238) || chr(8203)),
    (account_g, 'chk-rec-g', 'chk-uid-g', 'Gone Name');

  insert into public.account_settings (user_id, show_in_records)
  values (account_a, true), (account_b, false), (account_e, true), (account_f, true), (account_g, true);

  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, assists, final_hits, play_mode_id, recorded_by)
  values
    ('chk-line-1', 9.0, now() - interval '60 minutes', 'chk-uid-a', 'Impostor Name', 1, 9001, 40, 12, 9, 1, 'chk-rec-a'),
    ('chk-line-2', 9.0, now() - interval '50 minutes', 'chk-uid-a', 'Aurora', 1, 9010, 95, null, null, 1, 'chk-rec-x'),
    ('chk-line-3', 9.0, now() - interval '55 minutes', 'chk-uid-b', 'Blaze', 1, 9020, 90, 90, null, 1, 'chk-rec-b'),
    ('chk-line-3d', 9.0, now() - interval '56 minutes', 'chk-uid-dflt', 'Default', 1, 9021, 91, null, null, 1, 'chk-rec-d'),
    ('chk-line-4', 9.0, now() - interval '45 minutes', 'chk-uid-z', 'ChkZed', 1, 9030, 70, 5, 60, 0, 'chk-rec-x'),
    ('chk-line-5', 9.0, now() - interval '44 minutes', 'chk-uid-y', 'ChkYara', 1, 9031, 60, 80, 61, 1, 'chk-rec-x'),
    ('chk-line-6', 9.0, now() - interval '43 minutes', 'chk-uid-z', 'ChkZed', 1, 9032, 50, null, null, 1, 'chk-rec-y'),
    ('chk-line-7', 9.0, now() - interval '42 minutes', 'chk-uid-w', 'ChkWren', 1, 9033, 45, null, null, 1, 'chk-rec-y'),
    ('chk-line-8', 9.0, now() - interval '41 minutes', 'chk-uid-m1', 'Arcade', 1, 9040, 99, null, null, 2, 'chk-rec-m1'),
    ('chk-line-9', 9.0, now() - interval '41 minutes', 'chk-uid-m2', 'NoMode', 1, 9041, 98, null, null, null, 'chk-rec-m2'),
    ('chk-line-9p', 9.0, now() - interval '41 minutes', 'chk-uid-m3', 'Practice', 1, 9042, 97, null, null, 3, 'chk-rec-m3'),
    ('chk-line-10', 9.0, now() - interval '40 minutes', 'chk-uid-c1', 'Over', 1, 9050, 101, null, null, 1, 'chk-rec-c1'),
    ('chk-line-11', 9.0, now() - interval '40 minutes', 'chk-uid-c2', 'Zero', 1, 9051, 0, null, null, 1, 'chk-rec-c2'),
    ('chk-line-11b', 9.0, now() - interval '40 minutes', 'chk-uid-c4', 'AtCap', 1, 9052, 100, null, null, 1, 'chk-rec-c4'),
    ('chk-line-12', 9.0, now() - interval '40 minutes', 'chk-uid-c3', 'NoHero', 1, 0, 55, null, null, 1, 'chk-rec-c3'),
    ('chk-line-13', 9.0, now() - interval '39 minutes', 'chk-uid-h', 'Hidden', 1, 9060, 80, null, null, 1, 'chk-rec-h'),
    ('chk-line-14', 9.0, now() - interval '38 minutes', 'chk-uid-dns', 'Forgotten', 1, 9070, 85, null, null, 1, 'chk-rec-d1'),
    ('chk-line-15', 9.0, now() - interval '38 minutes', null, '  Forgotten CHK ', 1, 9071, 84, null, null, 1, 'chk-rec-d2'),
    ('chk-line-16', 9.0, now() - interval '100 minutes', 'chk-uid-t1', 'ChkTie1', 1, 9080, 30, null, null, 1, 'chk-rec-t1'),
    ('chk-line-17', 9.0, now() - interval '90 minutes', 'chk-uid-t2', 'ChkTie2', 1, 9081, 30, null, null, 1, 'chk-rec-t2'),
    ('chk-line-18', 9.0, now() - interval '80 minutes', 'chk-uid-t1', 'ChkTie1', 1, 9082, 30, null, null, 1, 'chk-rec-t1'),
    ('chk-line-19', 9.0, now() - interval '37 minutes', null, 'Ghost', 1, 9090, 20, null, null, 1, 'chk-rec-n1'),
    ('chk-line-20', 9.0, now() - interval '36 minutes', null, 'GHOST ', 1, 9091, 25, null, null, 1, 'chk-rec-n2'),
    ('chk-line-21', 9.0, now() - interval '35 minutes', 'chk-uid-f1', 'ChkPlain', 1, 9100, 10, null, null, 1, 'chk-rec-f1'),
    ('chk-line-22', 9.0, now() - interval '34 minutes', 'chk-uid-e', 'Eclipse', 1, 9110, 5, null, null, 1, 'chk-rec-e'),
    ('chk-line-23', 9.0, now() - interval '33 minutes', 'chk-uid-e2', 'ChkMate', 1, 9112, 2, null, null, 1, 'chk-rec-e'),
    ('chk-line-24', 9.0, now() - interval '32 minutes', 'chk-uid-f', 'ChkFade', 1, 9120, 15, null, null, 1, 'chk-rec-f'),
    ('chk-line-25', 9.0, now() - interval '31 minutes', 'chk-uid-g', 'ChkGone', 1, 9130, 12, null, null, 1, 'chk-rec-g');

  insert into public.participant_hero_figures (participant_id, hero_id, seconds, damage_dealt, healing, damage_blocked)
  select p.id, v.hero_id, v.seconds, v.damage, v.healing, v.blocked
  from (values
    ('chk-line-1', 9001, 600::integer, 20000::integer, null::integer, 5000::integer),
    ('chk-line-1', 9002, 100::integer, 30000::integer, 70000::integer, null::integer),
    ('chk-line-1', 9003, 0::integer, 1000::integer, 1000::integer, 1000::integer),
    ('chk-line-1', 9004, null::integer, 1000::integer, 1000::integer, 1000::integer),
    ('chk-line-1', 9005, 300::integer, 50000::integer, 100::integer, 70000::integer),
    ('chk-line-2', 9010, 600::integer, 39000::integer, null::integer, null::integer),
    ('chk-line-3', 9020, 600::integer, 39000::integer, null::integer, null::integer),
    ('chk-line-21', 9100, 600::integer, 15000::integer, null::integer, null::integer),
    ('chk-line-22', 9111, 600::integer, 30000::integer, 70000::integer, 60000::integer),
    ('chk-line-24', 9121, 60::integer, null::integer, 6000::integer, null::integer)
  ) as v(fingerprint, hero_id, seconds, damage, healing, blocked)
  join public.participants p on p.fingerprint = v.fingerprint;

  insert into public.records_hidden (participant_id, note)
  select id, 'check' from public.participants where fingerprint in ('chk-line-13');

  insert into public.do_not_store (kind, key) values
    ('uid', 'chk-uid-dns'),
    ('name', 'forgotten chk'),
    ('name', 'gone name');

  -- 55 anonymous uploaders with one kill each, to prove the board stops at 50.
  insert into public.participants
    (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, play_mode_id, recorded_by)
  select 'chk-line-bulk' || n, 9.0, now() - make_interval(mins => 20 + n), 'chk-uid-bulk-' || n, 'Bulk' || n, 1, 9500 + n, 1, 1,
         'chk-rec-bulk-' || n
  from generate_series(1, 55) as n;

  -- The read, as the web server calls it.
  set local role service_role;
  answer := public.read_pulse_records();
  reset role;

  boards := pg_temp.planted_boards(answer);

  if (select array_agg(c ->> 'key') from jsonb_array_elements(answer -> 'categories') c)
     is distinct from array['kills', 'assists', 'final_hits', 'damage', 'healing', 'blocked'] then
    raise exception 'check failed: the categories are not the six boards in order (%)', answer;
  end if;
  raise notice 'ok: six boards, in order';

  -- Naming: the two-key match plus the setting. Lines 2 (Aurora's uid from another uploader), 3 (naming
  -- off) and 3d (never set) must be on no board, and the name is the link's with invisible characters gone.
  if boards -> 'kills' is distinct from
     '["9052:100:-", "9030:70:-", "9033:45:-", "9001:40:AuroraPrime", "9080:30:-", "9081:30:-", "9091:25:-", "9100:10:-", "9110:5:Eclipse"]'::jsonb then
    raise exception 'check failed: the kills board is not the planted expectation (%)', boards -> 'kills';
  end if;
  raise notice 'ok: only the two-key match with naming on is named; the link''s name is used, not the line''s';

  if boards::text ~ '9010|9020|9021|9120|9121|9130' then
    raise exception 'check failed: a squatter, a naming-off player, a never-set player, a player whose name cleans to nothing or a player whose link name is on do_not_store is on a board (%)', boards;
  end if;
  raise notice 'ok: the same uid from another uploader, naming off, never set, a name that cleans to nothing and a link name on do_not_store are all left off';

  if boards -> 'assists' is distinct from '["9031:80:-", "9001:12:AuroraPrime"]'::jsonb
     or boards -> 'final_hits' is distinct from '["9030:60:-", "9001:9:AuroraPrime"]'::jsonb then
    raise exception 'check failed: assists or final hits are not the planted expectation (%, %)', boards -> 'assists', boards -> 'final_hits';
  end if;
  raise notice 'ok: each board is worked out on its own (a ceiling of exactly 60 final hits is kept, 61 is not)';

  -- Figures: named players only, and only a plausible segment with time played.
  if boards -> 'damage' is distinct from '["9111:30000:Eclipse", "9001:20000:AuroraPrime"]'::jsonb
     or boards -> 'healing' is distinct from '["9005:100:AuroraPrime"]'::jsonb
     or boards -> 'blocked' is distinct from '["9111:60000:Eclipse", "9001:5000:AuroraPrime"]'::jsonb then
    raise exception 'check failed: a figure board is not the planted expectation (%)', boards;
  end if;
  raise notice 'ok: damage, healing and blocked hold named players only, per hero, within the ceilings';

  if ((boards -> 'damage')::text || (boards -> 'healing')::text || (boards -> 'blocked')::text) ~ '9002|9003|9004|9100' then
    raise exception 'check failed: a segment over its per-minute ceiling, with no time played, or from an unnamed player is on a board (%)', boards;
  end if;
  raise notice 'ok: a per-minute rate over the ceiling, zero or missing seconds and an unnamed player''s figures are left out';

  -- Forgery guards on the lines.
  if boards::text ~ '9040|9041|9042' then
    raise exception 'check failed: a line outside Quick Match and Competitive is on a board (%)', boards;
  end if;
  if boards::text ~ '9050|9051' or exists (
       select 1 from jsonb_array_elements(answer -> 'categories') c, jsonb_array_elements(c -> 'rows') r
       where (r ->> 'heroId')::integer = 0) then
    raise exception 'check failed: a value over its ceiling, a value of 0 or a line with no hero is on a board (%)', boards;
  end if;
  if boards::text ~ '9060|9070|9071' then
    raise exception 'check failed: a hidden line or a do_not_store player is on a board (%)', boards;
  end if;
  -- The Pulse Records pages show a board only from 2 rows and read that as 2 distinct uploaders, so
  -- this check (one row per uploader) is what that gate relies on.
  if boards::text ~ '9031:60|9032|9090|9082|9112' then
    raise exception 'check failed: a second row for one player or one uploader is on a board (%)', boards;
  end if;
  raise notice 'ok: mode, ceilings, the hide list, do_not_store, one row per player and one per uploader hold';

  -- 55 uploaders were planted and the board is cut at 50.
  if (select jsonb_array_length(c -> 'rows') from jsonb_array_elements(answer -> 'categories') c where c ->> 'key' = 'kills') <> 50 then
    raise exception 'check failed: the kills board is not cut at 50 rows';
  end if;
  raise notice 'ok: a board stops at 50 rows';

  -- The answer holds the keys the site needs and nothing that could identify a line, a recorder or a match.
  select array_agg(distinct m[1]) into found_keys from regexp_matches(answer::text, '"([A-Za-z]+)":', 'g') as m;
  if not (found_keys <@ allowed_keys) then
    raise exception 'check failed: the answer has a key outside the allowed set (%)', found_keys;
  end if;
  if answer::text ~ 'chk-uid|chk-rec|Impostor|Chk[A-Z]' then
    raise exception 'check failed: the answer carries a uid, a recorder or a name from the scoreboard';
  end if;
  if answer::text ~ '[\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]' then
    raise exception 'check failed: the answer carries a bidirectional or invisible character';
  end if;
  if answer ->> 'coveredFrom' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'check failed: coveredFrom is not a calendar date (%)', answer ->> 'coveredFrom';
  end if;
  raise notice 'ok: only heroId, value and name per row, a date and no uid, recorder, line id or match time';

  -- Naming off takes effect on the next read: A leaves every board, the others stay.
  update public.account_settings set show_in_records = false where user_id = account_a;
  set local role service_role;
  answer := public.read_pulse_records();
  reset role;
  boards := pg_temp.planted_boards(answer);
  if boards::text ~ '9001|9005|AuroraPrime' or boards -> 'damage' is distinct from '["9111:30000:Eclipse"]'::jsonb
     or boards -> 'healing' is distinct from '[]'::jsonb then
    raise exception 'check failed: a player who switched naming off is still on a board (%)', boards;
  end if;
  update public.account_settings set show_in_records = true where user_id = account_a;
  raise notice 'ok: switching naming off removes the player from every board at once';

  -- A hidden line goes at once, and its entry goes with the line.
  select id into hidden_id from public.participants where fingerprint = 'chk-line-7';
  insert into public.records_hidden (participant_id, note) values (hidden_id, 'check');
  set local role service_role;
  answer := public.read_pulse_records();
  reset role;
  if pg_temp.planted_boards(answer)::text ~ '9033' then
    raise exception 'check failed: a line added to the hide list is still on a board';
  end if;
  delete from public.participants where id = hidden_id;
  if exists (select 1 from public.records_hidden where participant_id = hidden_id) then
    raise exception 'check failed: a hide-list entry outlived its line';
  end if;
  raise notice 'ok: the hide list takes effect at once and goes with the line';

  -- forget_player removes the player at once and keeps the next uploader's row for the same uploader.
  perform public.forget_player('chk-uid-z', null);
  set local role service_role;
  answer := public.read_pulse_records();
  reset role;
  boards := pg_temp.planted_boards(answer);
  if boards::text ~ '9030|9032' or not (boards -> 'kills' @> '["9031:60:-"]'::jsonb) then
    raise exception 'check failed: forgetting a player left them on a board, or hid the uploader''s next best (%)', boards;
  end if;
  raise notice 'ok: forgetting a player removes them from the boards';

  -- Who may call it. The helpers are for the definer function only.
  set local role anon;
  begin
    perform public.read_pulse_records();
    raise exception 'check failed: anon executed the read';
  exception when insufficient_privilege then
    raise notice 'ok: anon cannot execute the read';
  end;

  reset role;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  begin
    perform public.read_pulse_records();
    raise exception 'check failed: a signed-in account executed the read';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in account cannot execute the read';
  end;

  reset role;
  set local role service_role;
  begin
    perform public.pulse_records_value_cap('kills');
    raise exception 'check failed: the service role executed a ceiling helper';
  exception when insufficient_privilege then
    raise notice 'ok: the ceiling helpers are not callable from the API';
  end;

  -- The tables stay closed to the publishable key and to a signed-in client.
  reset role;
  set local role anon;
  begin
    perform 1 from public.participants limit 1;
    raise exception 'check failed: anon read participants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.participant_hero_figures limit 1;
    raise exception 'check failed: anon read hero figures';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.account_settings limit 1;
    raise exception 'check failed: anon read account settings';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;
  begin
    perform 1 from public.participants limit 1;
    raise exception 'check failed: a signed-in client read participants';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.participant_hero_figures limit 1;
    raise exception 'check failed: a signed-in client read hero figures';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.records_hidden limit 1;
    raise exception 'check failed: a signed-in client read the hide list';
  exception when insufficient_privilege then null;
  end;
  raise notice 'ok: anon and signed-in clients cannot read participants, hero figures or the hide list';

  -- The setting is the owner's to read and nobody's to write from a client.
  if (select count(*) from public.account_settings) <> 1
     or (select count(*) from public.account_settings where user_id = account_b) <> 0 then
    raise exception 'check failed: a signed-in account saw settings that are not its own';
  end if;
  begin
    update public.account_settings set show_in_records = false where user_id = account_a;
    raise exception 'check failed: a signed-in client updated a setting';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.account_settings (user_id, show_in_records) values (account_d, true);
    raise exception 'check failed: a signed-in client inserted a setting';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.account_settings where user_id = account_a;
    raise exception 'check failed: a signed-in client deleted a setting';
  exception when insufficient_privilege then null;
  end;

  reset role;
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;
  if (select count(*) from public.account_settings where user_id = account_a) <> 0 then
    raise exception 'check failed: an account read another account''s setting';
  end if;

  reset role;
  set local role service_role;
  begin
    perform 1 from public.account_settings limit 1;
    raise exception 'check failed: the service role read account settings';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'ok: a setting is readable by its owner only and writable by no client';

  -- The posture of the function itself.
  if not exists (
    select 1 from pg_proc
    where oid = 'public.read_pulse_records()'::regprocedure
      and prosecdef
      and proconfig @> array['search_path=""']
  ) then
    raise exception 'check failed: read_pulse_records is not security definer with an empty search_path';
  end if;
  raise notice 'ok: security definer with an empty search_path';

  raise notice 'all Pulse Records checks passed';
end
$$;

rollback;
