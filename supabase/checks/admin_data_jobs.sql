-- Checks the admin data jobs (issue 494, ADR-0005):
--   * only an administrator can begin, run, finish or read; the anon and service roles and a signed-in
--     stranger are refused, and nobody but the functions can read the audit log;
--   * a key outside the allow-list starts nothing, and a second click while a run is open, or inside
--     the cooldown, is refused and writes no row;
--   * the audit row exists before the rebuild runs, a rebuild that is rolled back (as a timeout does)
--     leaves it open, and closing it as failed works once and only for the administrator who began it;
--   * a manual rebuild updates computed_at on an unfinished half-season and leaves computed_at and
--     frozen_at as they were on a frozen one, for all five rebuild families (play time through a
--     throwaway player and two throwaway matches);
--   * no frozen half-season in any of the five families changed, real ones included;
--   * a run open for over ten minutes reads as unfinished and no longer blocks the job;
--   * the status keeps a sync's scheduled runs apart from an administrator's, reads a pg_cron history
--     row with no start time without failing, and shows a rebuild's scheduled run when pg_cron has one;
--   * the audit log keeps its rows when the account is deleted.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/admin_data_jobs.sql
-- Judge it by the exit status: every failure is an exception (`check failed: ...`), which stops the
-- script with a non-zero exit. The notices are for reading, and are not the evidence; the last one,
-- "all admin data job checks passed", is only reached when nothing raised.
-- It holds locks until it rolls back, so a scheduled rebuild can wait a few seconds behind it. Do not
-- run it in minutes :07, :13, :17, :37 or :43 of the hour.
--
-- It never grants admin to a real account: it makes three throwaway users inside the transaction, and
-- throwaway half-seasons (998.0 and 999.0, and 97.0 and 98.0 for play time, whose matches name their own
-- half-season between 0 and 99) with one match each. Every real unfrozen half-season is
-- rebuilt inside the transaction too, because a rebuild job rebuilds them all; that is rolled back.

begin;

do $$
declare
  admin_a uuid := gen_random_uuid();
  admin_b uuid := gen_random_uuid();
  stranger uuid := gen_random_uuid();
  claims_a text;
  claims_b text;
  claims_stranger text;
  open_season constant numeric := 998.0;
  frozen_season constant numeric := 999.0;
  play_open_season constant numeric := 97.0;
  play_frozen_season constant numeric := 98.0;
  play_player bigint;
  old_computed constant timestamptz := '2000-01-01T00:00:00Z';
  old_frozen constant timestamptz := '2000-01-02T00:00:00Z';
  frozen_sql constant text := $q$
    select 'hero' as fam, half_season, computed_at, frozen_at from public.hero_aggregate_half_seasons where frozen_at is not null
    union all select 'extended', half_season, computed_at, frozen_at from public.extended_aggregate_half_seasons where frozen_at is not null
    union all select 'community', half_season, computed_at, frozen_at from public.community_match_half_seasons where frozen_at is not null
    union all select 'play_time', half_season, computed_at, frozen_at from public.play_time_aggregate_half_seasons where frozen_at is not null
    union all select 'pair', half_season, computed_at, frozen_at from public.hero_pair_aggregate_half_seasons where frozen_at is not null
  $q$;
  family record;
  answer jsonb;
  entry jsonb;
  run_id bigint;
  other_run bigint;
  seen integer;
  audit public.admin_audit_log%rowtype;
  half_season_row record;
  cron_job bigint;
begin
  insert into auth.users (id, email)
  values
    (admin_a, 'jobs-check-a@example.invalid'),
    (admin_b, 'jobs-check-b@example.invalid'),
    (stranger, 'jobs-check-stranger@example.invalid');
  insert into public.admins (user_id, note)
  values (admin_a, 'admin_data_jobs.sql check'), (admin_b, 'admin_data_jobs.sql check');

  -- Real runs would put a job in its cooldown. They are put back by the rollback below.
  delete from public.admin_audit_log;

  claims_a := json_build_object('sub', admin_a, 'role', 'authenticated')::text;
  claims_b := json_build_object('sub', admin_b, 'role', 'authenticated')::text;
  claims_stranger := json_build_object('sub', stranger, 'role', 'authenticated')::text;

  -- One match in an unfinished half-season and one in a frozen one, and the half-season rows to match.
  insert into public.participants (fingerprint, half_season, played_at, uid, name, team, hero_id, kills, deaths, assists, is_win, recorded_by)
  select 'jobs-check-' || s::text, s, now(), 'jobs-check-uid', 'Jobs check', 1, 1011, 1, 1, 1, true, 'jobs-check-recorder'
  from unnest(array[open_season, frozen_season]) as s;

  insert into public.match_hero_kills (fingerprint, half_season, played_at, killer_hero, victim_hero, kills)
  select 'jobs-check-' || s::text, s, now(), 'jobs-check', 'jobs-check', 1
  from unnest(array[open_season, frozen_season]) as s;

  for family in
    select * from (values
      ('hero_aggregate_half_seasons'),
      ('extended_aggregate_half_seasons'),
      ('community_match_half_seasons'),
      ('hero_pair_aggregate_half_seasons')
    ) as f(tbl)
  loop
    execute format(
      'insert into public.%I (half_season, computed_at, frozen_at) values ($1, $2, null), ($3, $2, $4)',
      family.tbl
    ) using open_season, old_computed, frozen_season, old_frozen;
  end loop;

  -- Play time reads tracked matches, not participants: one player, one match in each of its half-seasons.
  insert into public.players (provider, provider_player_uid, player_name, normalized_name)
  values ('jobs-check', 'jobs-check-player', 'Jobs check', 'jobs check')
  returning id into play_player;

  insert into public.tracked_matches (player_id, provider, match_uid, played_at, raw_payload, performance)
  select play_player, 'jobs-check', 'jobs-check-' || s::text, now() - interval '1 day',
         jsonb_build_object('match_season', s, 'play_mode_id', 1),
         jsonb_build_object('is_win', true, 'player_uid', 'jobs-check-player')
  from unnest(array[play_open_season, play_frozen_season]) as s;

  insert into public.play_time_aggregate_half_seasons (half_season, computed_at, frozen_at)
  values (play_open_season, old_computed, null), (play_frozen_season, old_computed, old_frozen);

  execute 'create temp table jobs_check_frozen on commit drop as ' || frozen_sql;

  -- Nobody but an administrator may use any of the four.
  perform set_config('request.jwt.claims', claims_stranger, true);
  set local role authenticated;

  begin
    perform public.admin_begin_run('game-stats');
    raise exception 'check failed: a signed-in stranger began a run';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in stranger cannot begin a run';
  end;

  begin
    perform public.admin_run_rebuild(1);
    raise exception 'check failed: a signed-in stranger ran a rebuild';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in stranger cannot run a rebuild';
  end;

  begin
    perform public.admin_finish_run(1, 'failed', null);
    raise exception 'check failed: a signed-in stranger closed a run';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in stranger cannot close a run';
  end;

  begin
    perform public.admin_data_jobs_status();
    raise exception 'check failed: a signed-in stranger read the job status';
  exception when insufficient_privilege then
    raise notice 'ok: a signed-in stranger cannot read the job status';
  end;

  begin
    perform 1 from public.admin_audit_log limit 1;
    raise exception 'check failed: a signed-in account read the audit log directly';
  exception when insufficient_privilege then
    raise notice 'ok: no signed-in account reads the audit log directly';
  end;

  begin
    perform public.data_job_cooldown('game-stats');
    raise exception 'check failed: a signed-in account called an internal helper';
  exception when insufficient_privilege then
    raise notice 'ok: the helpers are not callable by a signed-in account';
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;

  begin
    perform public.admin_begin_run('game-stats');
    raise exception 'check failed: the anon role began a run';
  exception when insufficient_privilege then
    raise notice 'ok: the anon role cannot begin a run';
  end;

  reset role;
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  set local role service_role;

  begin
    perform public.admin_begin_run('game-stats');
    raise exception 'check failed: the service role began a run';
  exception when insufficient_privilege then
    raise notice 'ok: the service role cannot begin a run, so the website''s service key cannot start one';
  end;

  begin
    perform 1 from public.admin_audit_log limit 1;
    raise exception 'check failed: the service role read the audit log';
  exception when insufficient_privilege then
    raise notice 'ok: the service role cannot read the audit log';
  end;

  -- The administrator.
  reset role;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;

  begin
    perform public.admin_begin_run('recompute-hero-aggregates; drop table public.admins');
    raise exception 'check failed: a key outside the allow-list began a run';
  exception when invalid_parameter_value then
    raise notice 'ok: a key outside the allow-list is refused';
  end;

  begin
    perform public.admin_begin_run('');
    raise exception 'check failed: an empty key began a run';
  exception when invalid_parameter_value then
    raise notice 'ok: an empty key is refused';
  end;

  reset role;
  select count(*) into seen from public.admin_audit_log;
  if seen <> 0 then
    raise exception 'check failed: a refused key left % audit rows', seen;
  end if;
  raise notice 'ok: a refused key writes nothing';

  -- Every rebuild: the row first, then the rebuild, then the cooldown.
  for family in
    select * from (values
      ('recompute-hero-aggregates', 'hero_aggregate_half_seasons'),
      ('recompute-extended-aggregates', 'extended_aggregate_half_seasons'),
      ('recompute-community-match-aggregates', 'community_match_half_seasons'),
      ('recompute-hero-pair-aggregates', 'hero_pair_aggregate_half_seasons'),
      ('recompute-play-time-aggregates', 'play_time_aggregate_half_seasons')
    ) as f(job, tbl)
  loop
    set local role authenticated;
    answer := public.admin_begin_run(family.job);

    if answer ->> 'status' is distinct from 'started' then
      raise exception 'check failed: % did not start (%)', family.job, answer;
    end if;
    run_id := (answer ->> 'runId')::bigint;

    -- The second click, while the first is open, is refused and writes nothing.
    answer := public.admin_begin_run(family.job);
    if answer ->> 'status' is distinct from 'busy' or answer ->> 'reason' is distinct from 'running' then
      raise exception 'check failed: % was started twice at once (%)', family.job, answer;
    end if;
    if (answer ->> 'retryAt')::timestamptz <= clock_timestamp() then
      raise exception 'check failed: % was refused with a retry time in the past (%)', family.job, answer;
    end if;

    reset role;
    select * into audit from public.admin_audit_log where id = run_id;
    if audit.actor_id is distinct from admin_a or audit.job <> family.job or audit.outcome <> 'running' or audit.finished_at is not null then
      raise exception 'check failed: the audit row of % was not open, for the administrator, before the rebuild (%)', family.job, audit;
    end if;
    select count(*) into seen from public.admin_audit_log where job = family.job;
    if seen <> 1 then
      raise exception 'check failed: % has % audit rows after a refused second click', family.job, seen;
    end if;

    set local role authenticated;
    answer := public.admin_run_rebuild(run_id);
    reset role;

    select * into audit from public.admin_audit_log where id = run_id;
    if audit.outcome <> 'succeeded' or audit.finished_at is null
       or (audit.detail ->> 'halfSeasons')::integer is distinct from (answer ->> 'halfSeasons')::integer
       or audit.detail ->> 'result' is distinct from 'rebuilt' then
      raise exception 'check failed: the audit row of % did not record the rebuild (%)', family.job, audit;
    end if;
    raise notice 'ok: % writes its audit row first and closes it with the half-seasons rebuilt', family.job;

    execute format('select computed_at, frozen_at from public.%I where half_season = $1', family.tbl)
      into half_season_row
      using case when family.job = 'recompute-play-time-aggregates' then play_open_season else open_season end;
    if half_season_row.computed_at <= old_computed or half_season_row.frozen_at is not null then
      raise exception 'check failed: % did not update an unfinished half-season (%)', family.job, half_season_row;
    end if;

    execute format('select computed_at, frozen_at from public.%I where half_season = $1', family.tbl)
      into half_season_row
      using case when family.job = 'recompute-play-time-aggregates' then play_frozen_season else frozen_season end;
    if half_season_row.computed_at <> old_computed or half_season_row.frozen_at <> old_frozen then
      raise exception 'check failed: % changed a frozen half-season (%)', family.job, half_season_row;
    end if;
    raise notice 'ok: % updates computed_at on an unfinished half-season and leaves a frozen one alone', family.job;

    set local role authenticated;
    answer := public.admin_begin_run(family.job);
    reset role;

    if answer ->> 'status' is distinct from 'busy' or answer ->> 'reason' is distinct from 'cooldown' then
      raise exception 'check failed: % could be started again straight away (%)', family.job, answer;
    end if;
    if (answer ->> 'retryAt')::timestamptz <= clock_timestamp() then
      raise exception 'check failed: the cooldown of % has a retry time in the past (%)', family.job, answer;
    end if;
    select count(*) into seen from public.admin_audit_log where job = family.job;
    if seen <> 1 then
      raise exception 'check failed: a request inside the cooldown of % wrote a row', family.job;
    end if;
    raise notice 'ok: % refuses a second run inside its cooldown, with when to retry', family.job;
  end loop;

  execute format('select count(*) from (select * from jobs_check_frozen except (%s)) lost', frozen_sql) into seen;
  if seen <> 0 then
    raise exception 'check failed: % frozen half-seasons were changed or lost by the rebuilds', seen;
  end if;
  raise notice 'ok: no frozen half-season in any of the five families changed';

  -- pg_cron's history is read inside the function. If it has runs of these jobs, the page must show one;
  -- a permission failure would otherwise look like an empty state.
  select count(*) into seen
  from cron.job_run_details d join cron.job j on j.jobid = d.jobid
  where j.jobname like 'recompute-%-aggregates' and d.start_time is not null;

  set local role authenticated;
  answer := public.admin_data_jobs_status();
  reset role;

  if seen > 0 and not exists (
    select 1 from jsonb_array_elements(answer) e
    where e ->> 'job' like 'recompute-%' and jsonb_typeof(e -> 'lastScheduled') = 'object'
  ) then
    raise exception 'check failed: pg_cron has % runs of the rebuild jobs but the status shows none of them', seen;
  end if;
  raise notice 'ok: a rebuild''s scheduled run is shown when pg_cron has one (% in its history)', seen;

  -- pg_cron can leave a history row with no start time. It must not take the page down or be shown first.
  select jobid into cron_job from cron.job where jobname = 'recompute-hero-aggregates';
  if cron_job is not null then
    insert into cron.job_run_details (jobid, runid, status, start_time)
    values (cron_job, 9000000010, 'starting', null);

    set local role authenticated;
    answer := public.admin_data_jobs_status();
    reset role;
    select e into entry from jsonb_array_elements(answer) e where e ->> 'job' = 'recompute-hero-aggregates';

    if jsonb_array_length(answer) <> 7
       or (jsonb_typeof(entry -> 'lastScheduled') = 'object' and entry -> 'lastScheduled' ->> 'startedAt' is null) then
      raise exception 'check failed: a history row with no start time broke or filled the status (%)', entry;
    end if;
    raise notice 'ok: a pg_cron history row with no start time is left out';
  end if;

  -- A rebuild the database stops rolls back with its own transaction; the row written before it stays open.
  delete from public.admin_audit_log where job = 'recompute-hero-aggregates';
  set local role authenticated;
  answer := public.admin_begin_run('recompute-hero-aggregates');
  run_id := (answer ->> 'runId')::bigint;

  begin
    perform public.admin_run_rebuild(run_id);
    raise exception 'stopping the rebuild' using errcode = '57014';
  exception when query_canceled then
    null;
  end;

  reset role;
  select * into audit from public.admin_audit_log where id = run_id;
  if audit.id is null or audit.outcome <> 'running' then
    raise exception 'check failed: a rebuild that was stopped erased or closed its audit row (%)', audit;
  end if;
  raise notice 'ok: a rebuild that is rolled back leaves its audit row open';

  -- Another administrator can neither run nor close it.
  perform set_config('request.jwt.claims', claims_b, true);
  set local role authenticated;

  begin
    perform public.admin_run_rebuild(run_id);
    raise exception 'check failed: another administrator ran someone else''s run';
  exception when invalid_parameter_value then
    raise notice 'ok: only the administrator who began a run can run it';
  end;

  if public.admin_finish_run(run_id, 'failed', null) is distinct from false then
    raise exception 'check failed: another administrator closed someone else''s run';
  end if;
  raise notice 'ok: only the administrator who began a run can close it';

  -- The one who began it closes it as failed, once.
  reset role;
  perform set_config('request.jwt.claims', claims_a, true);
  set local role authenticated;

  begin
    perform public.admin_finish_run(run_id, 'succeeded and then some', null);
    raise exception 'check failed: an outcome outside the list was accepted';
  exception when invalid_parameter_value then
    raise notice 'ok: only succeeded and failed close a run';
  end;

  if public.admin_finish_run(run_id, 'failed', '{"result":"failed","message":"stopped"}'::jsonb) is distinct from true then
    raise exception 'check failed: the administrator could not close its own open run';
  end if;
  if public.admin_finish_run(run_id, 'succeeded', '{"result":"rebuilt","halfSeasons":1}'::jsonb) is distinct from false then
    raise exception 'check failed: a closed run was closed a second time';
  end if;
  reset role;
  select * into audit from public.admin_audit_log where id = run_id;
  if audit.outcome <> 'failed' or audit.finished_at is null or audit.detail ->> 'message' is distinct from 'stopped' then
    raise exception 'check failed: the closed run does not say it failed (%)', audit;
  end if;
  raise notice 'ok: an open run is closed once, as failed, by the administrator who began it';

  -- A closed run cannot be rebuilt again.
  set local role authenticated;
  begin
    perform public.admin_run_rebuild(run_id);
    raise exception 'check failed: a closed run was run again';
  exception when invalid_parameter_value then
    raise notice 'ok: a closed run cannot be run again';
  end;

  -- A run left open for over ten minutes reads as unfinished and stops blocking the job.
  reset role;
  delete from public.admin_audit_log where job = 'home-news';
  insert into public.admin_audit_log (actor_id, job, started_at)
  values (admin_a, 'home-news', clock_timestamp() - interval '11 minutes');

  set local role authenticated;
  answer := public.admin_data_jobs_status();
  select e into entry from jsonb_array_elements(answer) e where e ->> 'job' = 'home-news';
  if entry -> 'lastManual' ->> 'outcome' is distinct from 'unfinished' then
    raise exception 'check failed: a run open for 11 minutes did not read as unfinished (%)', entry;
  end if;
  if jsonb_typeof(entry -> 'wait') <> 'null' then
    raise exception 'check failed: an unfinished run still blocked its job (%)', entry;
  end if;
  raise notice 'ok: a run open for over ten minutes reads as unfinished and does not block the job';

  reset role;
  update public.admin_audit_log set started_at = clock_timestamp() - interval '5 minutes' where job = 'home-news';
  set local role authenticated;
  answer := public.admin_begin_run('home-news');
  if answer ->> 'status' is distinct from 'busy' or answer ->> 'reason' is distinct from 'running' then
    raise exception 'check failed: a run open for 5 minutes did not block its job (%)', answer;
  end if;
  raise notice 'ok: a run open for under ten minutes blocks its job';

  -- The status keeps a sync's scheduled runs apart from an administrator's.
  reset role;
  insert into public.sync_runs (source_key, status, message, started_at, finished_at, by_admin)
  values
    ('game-stats', 'success', 'jobs check scheduled', clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day', false),
    ('game-stats', 'success', 'jobs check manual', clock_timestamp() + interval '2 days', clock_timestamp() + interval '2 days', true);

  set local role authenticated;
  answer := public.admin_data_jobs_status();
  select e into entry from jsonb_array_elements(answer) e where e ->> 'job' = 'game-stats';
  if entry -> 'lastScheduled' ->> 'message' is distinct from 'jobs check scheduled' then
    raise exception 'check failed: the last scheduled run included an administrator''s run (%)', entry;
  end if;
  raise notice 'ok: the last scheduled run of a sync leaves out an administrator''s runs';

  select count(*) into seen from jsonb_array_elements(answer) e
  where e ->> 'job' in (
    'recompute-hero-aggregates', 'recompute-extended-aggregates', 'recompute-community-match-aggregates',
    'recompute-play-time-aggregates', 'recompute-hero-pair-aggregates', 'home-news', 'game-stats'
  );
  if jsonb_array_length(answer) <> 7 or seen <> 7 then
    raise exception 'check failed: the status does not list exactly the seven jobs (%)', answer;
  end if;
  raise notice 'ok: the status lists exactly the seven jobs';

  -- The audit log outlives an account: the actor is cleared, the row stays.
  reset role;
  insert into public.admin_audit_log (actor_id, job) values (admin_b, 'game-stats') returning id into other_run;
  delete from auth.users where id = admin_b;

  select * into audit from public.admin_audit_log where id = other_run;
  if audit.id is null or audit.actor_id is not null then
    raise exception 'check failed: deleting the account did not keep the audit row with no actor (%)', audit;
  end if;
  raise notice 'ok: deleting an account keeps its audit rows and clears the actor';
  raise notice 'all admin data job checks passed';
end
$$;

rollback;
