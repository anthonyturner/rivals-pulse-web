import type { DataJobSchedule } from '../../../../contracts/admin-data-jobs.model';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function hourMatches(field: string, hour: number): boolean {
  if (field === '*') {
    return true;
  }

  return field.startsWith('*/') ? hour % Number(field.slice(2)) === 0 : hour === Number(field);
}

/** The first time after `after` that the schedule is due, in milliseconds. pg_cron, Vercel and GitHub all keep UTC here. */
export function nextRunAt(schedule: DataJobSchedule, after: number): number {
  const [minute, hour] = schedule.split(' ');
  const firstCandidate = Math.floor(after / HOUR) * HOUR + Number(minute) * MINUTE;

  // Every schedule this type allows is due at least once a day, so 25 hours always finds it.
  for (let hours = 0; hours <= 24; hours++) {
    const candidate = firstCandidate + hours * HOUR;

    if (candidate > after && hourMatches(hour, new Date(candidate).getUTCHours())) {
      return candidate;
    }
  }

  throw new RangeError(`${schedule} is never due`);
}

/** `5h 12m`, `23m 12s` or `12s`. Rounded up, so it never reads as zero while the run is still ahead. */
export function timeLeftLabel(milliseconds: number): string {
  const total = Math.ceil(milliseconds / SECOND);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}
