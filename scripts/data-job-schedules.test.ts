import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DATA_JOBS, GITHUB_JOBS } from '../src/contracts/admin-data-jobs.model.ts';

/**
 * The admin page counts down from the schedules in its job list. This holds each one to the file
 * that really sets it, and fails on any way of changing a pg_cron schedule it cannot follow.
 */

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

/** Every migration, oldest first, without SQL comments, as one text: later statements win. */
const SQL = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .sort()
  .map((file) => read(`supabase/migrations/${file}`).replace(/--.*$/gm, ''))
  .join('\n');

const lastIndex = (pattern: RegExp): number => Math.max(-1, ...[...SQL.matchAll(pattern)].map((match) => match.index));

function pgCronSchedule(job: string): string | undefined {
  const schedules = [...SQL.matchAll(new RegExp(String.raw`cron\.schedule\s*\(\s*'${job}'\s*,\s*'([^']+)'`, 'gi'))];
  const last = schedules.at(-1);
  const unscheduled = lastIndex(new RegExp(String.raw`cron\.unschedule\b[^;]*'${job}'`, 'gi'));

  return last && last.index > unscheduled ? last[1] : undefined;
}

describe('the data job schedules on the admin page', () => {
  const crons = (JSON.parse(read('vercel.json')) as { crons: { path: string; schedule: string }[] }).crons;

  for (const job of DATA_JOBS) {
    it(`${job.key} matches what really schedules it`, () => {
      const actual = job.kind === 'rebuild' ? pgCronSchedule(job.key) : crons.find((cron) => cron.path === `/api/sync/${job.key}`)?.schedule;

      assert.equal(job.schedule, actual);
    });
  }

  it('changes a pg_cron schedule only by unscheduling and scheduling it by name, which the test above follows', () => {
    assert.doesNotMatch(SQL, /cron\.alter_job|update\s+cron\.job\b|cron\.schedule_in_database|schedule\s*:=/i);
  });

  for (const job of GITHUB_JOBS) {
    it(`${job.key} matches its GitHub workflow, which has one schedule`, () => {
      const crons = [...read(`.github/workflows/${job.workflow}`).matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]/gm)];

      assert.deepEqual(
        crons.map((match) => match[1]),
        [job.schedule],
      );
    });
  }
});
