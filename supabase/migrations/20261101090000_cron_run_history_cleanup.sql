-- pg_cron writes a row to cron.job_run_details for every run of every job and never removes one, so
-- the table only grows (the hourly jobs alone add about 100 a day). Delete the rows a week after the
-- run ended. A run with no end_time (still running, or one that failed to start) is dated by its
-- start_time, so an orphaned row is purged too and a fresh running one is kept.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-run-history';
    perform cron.schedule(
      'purge-cron-run-history',
      '47 3 * * *',
      $job$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days'$job$
    );
  else
    raise warning 'pg_cron is not available: cron.job_run_details is not cleaned up';
  end if;
exception when others then
  raise warning 'pg_cron job not scheduled (%): cron.job_run_details is not cleaned up', sqlerrm;
end
$$;
