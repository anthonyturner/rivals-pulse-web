-- Checks the pg_cron run history cleanup (issue 345): the job is scheduled and active, and the
-- command it runs deletes run rows older than seven days and keeps newer and still-running ones.
--
-- Run it against the project after the migration is applied; it changes nothing (it ends in a rollback):
--   npx supabase db query --linked -f supabase/checks/cron-run-history.sql
-- It prints a notice per passing check and raises an exception at the first failure.

begin;

do $$
declare
  cleanup cron.job%rowtype;
  old_run bigint := 9000000001;
  recent_run bigint := 9000000002;
  running_run bigint := 9000000003;
  left_over bigint[];
begin
  select * into cleanup from cron.job where jobname = 'purge-cron-run-history';
  if not found then
    raise exception 'check failed: the purge-cron-run-history job is not scheduled';
  end if;
  if not cleanup.active then
    raise exception 'check failed: the purge-cron-run-history job is not active';
  end if;
  raise notice 'ok: the job is scheduled and active';

  insert into cron.job_run_details (jobid, runid, status, start_time, end_time)
  values
    (cleanup.jobid, old_run, 'succeeded', now() - interval '8 days', now() - interval '8 days'),
    (cleanup.jobid, recent_run, 'succeeded', now() - interval '6 days', now() - interval '6 days'),
    (cleanup.jobid, running_run, 'running', now() - interval '8 days', null);

  execute cleanup.command;

  select coalesce(array_agg(runid order by runid), '{}') into left_over
  from cron.job_run_details
  where runid in (old_run, recent_run, running_run);

  if old_run = any (left_over) then
    raise exception 'check failed: a run older than seven days was kept';
  end if;
  raise notice 'ok: a run older than seven days is deleted';

  if not (recent_run = any (left_over)) then
    raise exception 'check failed: a run from the last seven days was deleted';
  end if;
  raise notice 'ok: a run from the last seven days is kept';

  if not (running_run = any (left_over)) then
    raise exception 'check failed: a run still in progress was deleted';
  end if;
  raise notice 'ok: a run still in progress is kept';
end
$$;

rollback;
