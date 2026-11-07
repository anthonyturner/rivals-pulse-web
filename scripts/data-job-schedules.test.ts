import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DATA_JOBS, GITHUB_JOBS } from '../src/contracts/admin-data-jobs.model.ts';

/** The admin page counts down from the schedules in its job list. These are the files that really set them. */
const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const MIGRATIONS = readdirSync(new URL('../supabase/migrations/', import.meta.url)).sort();

/** The schedule the newest migration gave a pg_cron job: each one replaces the job by name. */
function pgCronSchedule(job: string): string | undefined {
  const pattern = new RegExp(String.raw`cron\.schedule\(\s*'${job}',\s*'([^']+)'`, 'g');

  return MIGRATIONS.flatMap((file) => [...read(`supabase/migrations/${file}`).matchAll(pattern)].map((match) => match[1])).at(-1);
}

describe('the data job schedules on the admin page', () => {
  const crons = (JSON.parse(read('vercel.json')) as { crons: { path: string; schedule: string }[] }).crons;

  for (const job of DATA_JOBS) {
    it(`${job.key} matches what really schedules it`, () => {
      const actual = job.kind === 'rebuild' ? pgCronSchedule(job.key) : crons.find((cron) => cron.path === `/api/sync/${job.key}`)?.schedule;

      assert.equal(job.schedule, actual);
    });
  }

  for (const job of GITHUB_JOBS) {
    it(`${job.key} matches its GitHub workflow`, () => {
      const actual = /schedule:\s*\n\s*- cron: '([^']+)'/.exec(read(`.github/workflows/${job.workflow}`).replaceAll('\r\n', '\n'))?.[1];

      assert.equal(job.schedule, actual);
    });
  }
});
