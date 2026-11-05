-- Running the data jobs on demand from the admin area (issue 494, ADR-0005). Additive: it adds one
-- table, one column and functions, and changes nothing the overlay calls.
--
-- The jobs are the five hourly rebuilds (named by their pg_cron jobs) and the two syncs the website
-- runs on Vercel (`home-news`, `game-stats`, named by their `sync_runs.source_key`).
--
-- A run is three calls made with the administrator's own token, never a single one:
--   1. `admin_begin_run` checks the administrator, the allow-list and the cooldown, writes the audit
--      row and returns. Its transaction commits there, so what follows cannot erase the row.
--   2. A rebuild is `admin_run_rebuild`, which runs the job and closes the row in one transaction.
--      A sync runs on the web server, which has no other way to reach Steam and the official site.
--   3. `admin_finish_run` closes the row of a sync, and of a rebuild that failed or ran out of time
--      (a rolled-back transaction closes nothing, so the web server says how it ended).
-- A row nobody closed shows as unfinished once `data_job_unfinished_after()` has passed.

-- Which side ran a sync, so the page can show the last scheduled run apart from the last manual one.
-- The scheduled cron routes and the command-line syncs leave it false.
alter table public.sync_runs add column if not exists by_admin boolean not null default false;

-- Every administrator action that starts something, kept for good. The actor is set null, not
-- deleted, when the account goes, so the history outlives it. Issue 495 (clearing the web cache)
-- writes its runs here too, as another `job`.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  job text not null,
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  outcome text not null default 'running' check (outcome in ('running', 'succeeded', 'failed')),
  -- What the run came to, in the shape the page reads (src/contracts/admin-data-jobs.model.ts).
  detail jsonb
);

create index if not exists admin_audit_log_job_started_at_idx
  on public.admin_audit_log (job, started_at desc);

alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated, service_role;

-- The allow-list: the cooldown of each job, and null for any key that is not a job. Every function
-- below asks this, so adding a job (issue 495) is one line here and in the page's list.
create or replace function public.data_job_cooldown(p_job text) returns interval
language sql
immutable
security definer
set search_path = ''
as $$
  select case p_job
    when 'recompute-hero-aggregates' then interval '1 minute'
    when 'recompute-extended-aggregates' then interval '1 minute'
    when 'recompute-community-match-aggregates' then interval '1 minute'
    when 'recompute-play-time-aggregates' then interval '1 minute'
    when 'recompute-hero-pair-aggregates' then interval '1 minute'
    when 'game-stats' then interval '1 minute'
    when 'home-news' then interval '10 minutes'
  end
$$;

-- How long a run may stay open before it is called unfinished (its server stopped before closing it).
create or replace function public.data_job_unfinished_after() returns interval
language sql
immutable
security definer
set search_path = ''
as $$
  select interval '10 minutes'
$$;

-- Why the job cannot start now, or null when it can: its latest run is still open, or began less
-- than the cooldown ago. The cooldown counts from the start of a run, finished or not.
create or replace function public.data_job_wait(p_job text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last public.admin_audit_log%rowtype;
  v_cooldown interval := public.data_job_cooldown(p_job);
begin
  select * into v_last
  from public.admin_audit_log a
  where a.job = p_job
  order by a.started_at desc, a.id desc
  limit 1;

  if not found then
    return null;
  end if;

  if v_last.outcome = 'running' and v_last.started_at > clock_timestamp() - public.data_job_unfinished_after() then
    return jsonb_build_object(
      'reason', 'running',
      'retryAt', greatest(v_last.started_at + v_cooldown, clock_timestamp() + interval '10 seconds')
    );
  end if;

  if v_last.started_at + v_cooldown > clock_timestamp() then
    return jsonb_build_object('reason', 'cooldown', 'retryAt', v_last.started_at + v_cooldown);
  end if;

  return null;
end
$$;

-- Step 1. Answers {status: 'started', runId, startedAt}, or {status: 'busy', reason, retryAt} when a
-- run is open or the cooldown has not passed (nothing is written then). A key that is not a job is
-- an error. The lock makes two clicks at once start one run, not two.
create or replace function public.admin_begin_run(p_job text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wait jsonb;
  v_run public.admin_audit_log%rowtype;
begin
  if not public.is_admin() then
    raise exception 'admin_begin_run: not an administrator' using errcode = '42501';
  end if;

  if public.data_job_cooldown(p_job) is null then
    raise exception 'admin_begin_run: % is not a data job', p_job using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('admin_begin_run:' || p_job, 0));

  v_wait := public.data_job_wait(p_job);

  if v_wait is not null then
    return v_wait || jsonb_build_object('status', 'busy');
  end if;

  insert into public.admin_audit_log (actor_id, job)
  values ((select auth.uid()), p_job)
  returning * into v_run;

  return jsonb_build_object('status', 'started', 'runId', v_run.id, 'startedAt', v_run.started_at);
end
$$;

-- Step 2 for a rebuild. Runs the job the open run names, for the administrator who opened it, and
-- closes the run in the same transaction. Answers the number of half-seasons rebuilt. If the
-- rebuild fails or is stopped by the role's statement timeout, everything here rolls back and the
-- run stays open until `admin_finish_run` closes it as failed.
create or replace function public.admin_run_rebuild(p_run_id bigint) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.admin_audit_log%rowtype;
  v_rebuilt integer;
begin
  if not public.is_admin() then
    raise exception 'admin_run_rebuild: not an administrator' using errcode = '42501';
  end if;

  select * into v_run
  from public.admin_audit_log a
  where a.id = p_run_id and a.actor_id = (select auth.uid())
  for update;

  if not found or v_run.outcome <> 'running' then
    raise exception 'admin_run_rebuild: run % is not open', p_run_id using errcode = '22023';
  end if;

  case v_run.job
    when 'recompute-hero-aggregates' then v_rebuilt := public.recompute_hero_aggregates();
    when 'recompute-extended-aggregates' then v_rebuilt := public.recompute_extended_aggregates();
    when 'recompute-community-match-aggregates' then v_rebuilt := public.recompute_community_match_aggregates();
    when 'recompute-play-time-aggregates' then v_rebuilt := public.recompute_play_time_aggregates();
    when 'recompute-hero-pair-aggregates' then v_rebuilt := public.recompute_hero_pair_aggregates();
    else raise exception 'admin_run_rebuild: % is not a rebuild', v_run.job using errcode = '22023';
  end case;

  update public.admin_audit_log a
  set outcome = 'succeeded',
      finished_at = clock_timestamp(),
      detail = jsonb_build_object('result', 'rebuilt', 'halfSeasons', v_rebuilt)
  where a.id = p_run_id;

  return jsonb_build_object('halfSeasons', v_rebuilt);
end
$$;

-- Step 3. Closes the administrator's own open run with how it ended. Answers false, and changes
-- nothing, when there is no such open run (it was closed already, or it is another account's).
create or replace function public.admin_finish_run(p_run_id bigint, p_outcome text, p_detail jsonb) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_finish_run: not an administrator' using errcode = '42501';
  end if;

  if p_outcome not in ('succeeded', 'failed') then
    raise exception 'admin_finish_run: % is not an outcome', p_outcome using errcode = '22023';
  end if;

  update public.admin_audit_log a
  set outcome = p_outcome, finished_at = clock_timestamp(), detail = p_detail
  where a.id = p_run_id and a.actor_id = (select auth.uid()) and a.outcome = 'running';

  return found;
end
$$;

-- Each job's last scheduled run, last manual run, and whether it can start now. A rebuild's
-- scheduled run is read from the pg_cron history, a sync's from `sync_runs`; both are kept apart
-- from the manual runs, which come from the audit log. A history that cannot be read reads as none.
create or replace function public.admin_data_jobs_status() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rebuilds text[] := array[
    'recompute-hero-aggregates', 'recompute-extended-aggregates', 'recompute-community-match-aggregates',
    'recompute-play-time-aggregates', 'recompute-hero-pair-aggregates'
  ];
  v_syncs text[] := array['home-news', 'game-stats'];
  v_job text;
  v_result jsonb := '[]'::jsonb;
  v_scheduled jsonb;
  v_manual jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_data_jobs_status: not an administrator' using errcode = '42501';
  end if;

  foreach v_job in array v_rebuilds || v_syncs loop
    v_scheduled := null;

    if v_job = any (v_syncs) then
      select jsonb_build_object(
               'outcome', case s.status
                            when 'success' then 'succeeded'
                            when 'error' then 'failed'
                            when 'running' then case
                              when s.started_at <= clock_timestamp() - public.data_job_unfinished_after() then 'unfinished'
                              else 'running' end
                            else 'failed' end,
               'startedAt', s.started_at,
               'finishedAt', s.finished_at,
               'message', s.message)
        into v_scheduled
        from public.sync_runs s
       where s.source_key = v_job and not s.by_admin
       order by s.started_at desc
       limit 1;
    else
      begin
        select jsonb_build_object(
                 'outcome', case
                              when d.status = 'succeeded' then 'succeeded'
                              when d.status = 'failed' then 'failed'
                              when d.start_time <= clock_timestamp() - public.data_job_unfinished_after() then 'unfinished'
                              else 'running' end,
                 'startedAt', d.start_time,
                 'finishedAt', d.end_time,
                 'message', case when d.status = 'succeeded' then null else d.return_message end)
          into v_scheduled
          from cron.job_run_details d
          join cron.job j on j.jobid = d.jobid
         where j.jobname = v_job
         order by d.start_time desc
         limit 1;
      exception when undefined_table or insufficient_privilege then
        v_scheduled := null;
      end;
    end if;

    select jsonb_build_object(
             'outcome', case
                          when a.outcome = 'running' and a.started_at <= clock_timestamp() - public.data_job_unfinished_after() then 'unfinished'
                          else a.outcome end,
             'startedAt', a.started_at,
             'finishedAt', a.finished_at,
             'detail', a.detail)
      into v_manual
      from public.admin_audit_log a
     where a.job = v_job
     order by a.started_at desc, a.id desc
     limit 1;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'job', v_job,
      'lastScheduled', v_scheduled,
      'lastManual', v_manual,
      'wait', public.data_job_wait(v_job)
    ));
  end loop;

  return v_result;
end
$$;

-- Postgres lets `public` run a new function, and Supabase also grants it to `anon` and the service
-- role by default. The four an administrator calls are for `authenticated` alone (and each asks
-- `is_admin()` first, so a stranger who signs up gets an error). The helpers are for those four.
revoke execute on function public.data_job_cooldown(text) from public, anon, authenticated, service_role;
revoke execute on function public.data_job_unfinished_after() from public, anon, authenticated, service_role;
revoke execute on function public.data_job_wait(text) from public, anon, authenticated, service_role;
revoke execute on function public.admin_begin_run(text) from public, anon, service_role;
revoke execute on function public.admin_run_rebuild(bigint) from public, anon, service_role;
revoke execute on function public.admin_finish_run(bigint, text, jsonb) from public, anon, service_role;
revoke execute on function public.admin_data_jobs_status() from public, anon, service_role;
grant execute on function public.admin_begin_run(text) to authenticated;
grant execute on function public.admin_run_rebuild(bigint) to authenticated;
grant execute on function public.admin_finish_run(bigint, text, jsonb) to authenticated;
grant execute on function public.admin_data_jobs_status() to authenticated;
