import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * No database runs in these tests, so they read the SQL for the parts that fail quietly: the
 * scheduling guard that lets the migration apply where pg_cron is missing, and the delete that must
 * only ever touch finished runs older than a week. `supabase/checks/cron-run-history.sql` proves the
 * delete against the real table.
 */
const MIGRATION = new URL('../../migrations/20261101090000_cron_run_history_cleanup.sql', import.meta.url);
const sql = readFileSync(MIGRATION, 'utf8').replace(/--.*$/gm, '');

describe('the cron run history cleanup migration', () => {
  it('schedules the job only where pg_cron is available and warns instead of failing otherwise', () => {
    assert.match(sql, /if exists \(select 1 from pg_available_extensions where name = 'pg_cron'\)/);
    assert.match(sql, /else\s+raise warning 'pg_cron is not available/);
    assert.match(sql, /exception when others then\s+raise warning 'pg_cron job not scheduled/);
  });

  it('replaces the job by name so a second push does not schedule it twice', () => {
    const unschedule = sql.indexOf(`cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-run-history'`);
    const schedule = sql.indexOf(`cron.schedule(`);
    assert.ok(unschedule >= 0, 'unschedules by name');
    assert.ok(schedule > unschedule, 'schedules after unscheduling');
    assert.match(sql, /cron\.schedule\(\s*'purge-cron-run-history',\s*'\d+ \d+ \* \* \*'/);
  });

  it('deletes only finished runs older than seven days', () => {
    assert.match(sql, /delete from cron\.job_run_details where end_time < now\(\) - interval '7 days'/);
  });

  it('creates no table or function, so there is nothing to grant', () => {
    assert.doesNotMatch(sql, /create (table|or replace function|function)/i);
    assert.doesNotMatch(sql, /\bgrant\b/i);
  });
});
