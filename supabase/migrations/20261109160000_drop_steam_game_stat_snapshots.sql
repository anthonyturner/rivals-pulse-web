-- Drop the Steam game-stat snapshots (issue 743). /game-stats stopped reading them in issue 381: the
-- page now counts the app's own matches and players through `read_game_counts()`, so the two tables
-- and the function that filled them are dead. Tony approved destroying the stored history on
-- 2026-11-09 (about 2,400 hourly Steam player-count captures); a Supabase backup is the only way back.
--
-- Destructive, by design:
--   * `game_stat_snapshots` and `game_stat_snapshot_games` are dropped with their rows, indexes,
--     policies and grants (the games table holds the foreign key to the snapshots, so it goes first).
--   * `record_game_stat_snapshot` is dropped.
--   * The `sync_runs` rows with source key `game-stats` are deleted: no job has that key any more, so
--     nothing would ever read them. `admin_audit_log` rows for the key stay, since that log is kept
--     for good (20261104150000_admin_data_jobs.sql).
--
-- `data_job_cooldown` and `admin_data_jobs_status` are restated from 20261104150000_admin_data_jobs.sql
-- without `game-stats`, so the allow-list matches the jobs the website offers, and their grants are
-- stated again as they stood, so the migration can be read (and checked) on its own.

drop function if exists public.record_game_stat_snapshot(timestamptz, text, timestamptz, text, text, jsonb);
drop table if exists public.game_stat_snapshot_games;
drop table if exists public.game_stat_snapshots;

delete from public.sync_runs where source_key = 'game-stats';

-- The allow-list: the cooldown of each job, and null for any key that is not a job.
create or replace function public.data_job_cooldown(p_job text) returns interval
language sql
immutable
set search_path = ''
as $$
  select case p_job
    when 'recompute-hero-aggregates' then interval '1 minute'
    when 'recompute-extended-aggregates' then interval '1 minute'
    when 'recompute-community-match-aggregates' then interval '1 minute'
    when 'recompute-play-time-aggregates' then interval '1 minute'
    when 'recompute-hero-pair-aggregates' then interval '1 minute'
    when 'home-news' then interval '10 minutes'
  end
$$;

-- Each job's last scheduled run, last manual run, and whether it can start now. A rebuild's
-- scheduled run is read from the pg_cron history, a sync's from `sync_runs`; both are kept apart
-- from the manual runs, which come from the audit log. A history that cannot be read reads as none.
-- pg_cron writes a history row before it fills in `start_time`, so a row without one is left out: it
-- would sort first and have no start to show.
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
  v_syncs text[] := array['home-news'];
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
         where j.jobname = v_job and d.start_time is not null
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

revoke execute on function public.data_job_cooldown(text) from public, anon, authenticated, service_role;
revoke execute on function public.admin_data_jobs_status() from public, anon, service_role;
grant execute on function public.admin_data_jobs_status() to authenticated;
