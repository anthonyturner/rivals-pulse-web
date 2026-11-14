import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal, type Signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  DATA_JOBS,
  GITHUB_JOBS,
  type DataJobDefinition,
  type DataJobKey,
  type DataJobKind,
  type DataJobSchedule,
  type DataJobStatus,
} from '../../../../contracts/admin-data-jobs.model';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { describeDetail, describeRun, easternLabel, easternTimeLabel, type RunWords } from './data-jobs.describe';
import { nextRunAt, timeLeftLabel } from './data-jobs.schedule';
import { DataJobsService, type DataJobRunResult } from './data-jobs.service';

/** How long after a run is due the page reads the jobs again, so "Last scheduled run" has caught up. */
const SCHEDULED_RUN_GRACE_MS = 30_000;
/** How soon the page reads again while a scheduled run is still going, so its end shows promptly. */
const RUNNING_RECHECK_MS = 15_000;

/** Words for a run, with the class that colours them and the time it began. */
interface RunView extends RunWords {
  toneClass: string;
  startedAt: string;
  startedLabel: string;
}

/** When a job next runs by itself, as a time left and a time. */
interface NextRunView {
  timeLeft: string;
  at: string;
  atLabel: string;
}

interface ResultView extends RunWords {
  toneClass: string;
}

interface JobRow extends Omit<DataJobDefinition, 'key'> {
  key: DataJobKey;
  /** The Pulse Atlas files as one line, joined here so the template calls no method. */
  atlasList: string;
  scheduled: RunView | null;
  manual: RunView | null;
  /** What the job just did on this page, until the page is left. */
  result: ResultView | null;
  running: boolean;
  /** Why the button is off, or null when it is on. */
  hint: string | null;
}

interface JobGroup {
  kind: DataJobKind;
  title: string;
  intro: string;
  rows: JobRow[];
}

const GROUPS: readonly { kind: DataJobKind; title: string; intro: string }[] = [
  {
    kind: 'rebuild',
    title: 'Rebuilds',
    intro:
      'These recount the anonymous community numbers from the uploaded matches. They run in the database, ' +
      'normally once an hour. A half-season that is already frozen is never changed.',
  },
  {
    kind: 'sync',
    title: 'Syncs',
    intro: 'These read an outside site and store what they find. Each normally runs on a schedule.',
  },
];

function nextRunView(schedule: DataJobSchedule, now: number): NextRunView {
  const next = nextRunAt(schedule, now);
  const at = new Date(next).toISOString();

  return { timeLeft: timeLeftLabel(next - now), at, atLabel: easternLabel(at) };
}

const toneClass = (words: RunWords): string => `jobs__tone--${words.tone}`;

function runView(words: RunWords, startedAt: string): RunView {
  return { ...words, toneClass: toneClass(words), startedAt, startedLabel: easternLabel(startedAt) };
}

/** What a click came to, in words. A job that did not start or whose fate is unknown never reads as a run. */
function resultWords(result: DataJobRunResult): RunWords {
  switch (result.status) {
    case 'finished': {
      const words = describeDetail(result.run.detail);

      return result.run.recorded
        ? words
        : {
            ...words,
            note: [words.note, 'The run could not be written to the audit log, so "Last manual run" may not show it.']
              .filter(Boolean)
              .join(' '),
          };
    }
    case 'busy':
      return {
        tone: 'notice',
        headline: `${result.busy.error} It did not start. Try again after ${easternTimeLabel(result.busy.retryAt)}.`,
        note: null,
      };
    case 'refused':
      return {
        tone: 'bad',
        headline: 'The request was refused, so the job did not start.',
        note: 'Your sign-in may have ended, or this account may no longer be an administrator. Sign in again and retry.',
      };
    case 'unknown':
      return {
        tone: 'bad',
        headline: 'No readable answer came back, so it is not known whether the job ran.',
        note: 'Look at "Last manual run" below before trying again.',
      };
  }
}

/**
 * The admin page for running the data jobs on demand. It shows each job's last scheduled and last
 * manual run, starts one on a click, and says what the run really came to. All it knows of the
 * jobs is the list in the contracts and what the server answers; the server and the database
 * decide who may run what, and when.
 */
@Component({
  selector: 'app-admin-data-jobs',
  imports: [RouterLink, StatePanelComponent],
  templateUrl: './data-jobs-page.component.html',
  styleUrls: ['../../../shared/styles/guide-article.css', './data-jobs-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataJobsPageComponent {
  private readonly service = inject(DataJobsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly statuses = signal<readonly DataJobStatus[]>([]);
  /** The time of the last read. Only the countdowns follow the ticking clock, so no row is rebuilt every second. */
  private readonly now = signal(this.service.now());
  private readonly clock: Signal<number> = this.browser
    ? this.service.tickingClock(this.destroyRef)
    : signal(this.service.now()).asReadonly();
  private readonly runningJobs = signal<ReadonlySet<DataJobKey>>(new Set());
  private readonly results = signal<Readonly<Partial<Record<DataJobKey, ResultView>>>>({});
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;

  readonly state = signal<'loading' | 'ready' | 'unavailable'>('loading');
  /** The one live region on the page: what a click came to is read out here and shown beside its job. */
  readonly announcement = signal('');

  readonly groups = computed<JobGroup[]>(() => {
    const byKey = new Map(this.statuses().map((status) => [status.job, status]));
    const now = this.now();
    const running = this.runningJobs();
    const results = this.results();

    return GROUPS.map((group) => ({
      ...group,
      rows: DATA_JOBS.filter((job) => job.kind === group.kind).map((job): JobRow => {
        const status = byKey.get(job.key);
        const wait = status?.wait && Date.parse(status.wait.retryAt) > now ? status.wait : null;

        return {
          ...job,
          atlasList: job.atlasFiles.join(', '),
          scheduled: status?.lastScheduled ? runView(describeRun(status.lastScheduled), status.lastScheduled.startedAt) : null,
          manual: status?.lastManual ? runView(describeRun(status.lastManual), status.lastManual.startedAt) : null,
          result: results[job.key] ?? null,
          running: running.has(job.key),
          hint: wait
            ? `${wait.reason === 'running' ? 'Already running.' : 'Ran a moment ago.'} Available again after ${easternTimeLabel(wait.retryAt)}.`
            : null,
        };
      }),
    }));
  });

  readonly githubJobs = GITHUB_JOBS.map((job) => ({
    ...job,
    url: `https://github.com/anthonyturner/rivals-pulse-web/actions/workflows/${job.workflow}`,
  }));

  /** Each job's next scheduled run, by key, on the ticking clock. */
  readonly nextRuns = computed(() => {
    const clock = this.clock();

    return Object.fromEntries(
      [...DATA_JOBS, ...GITHUB_JOBS].map((job) => [job.key, nextRunView(job.schedule, clock)]),
    ) as Readonly<Record<string, NextRunView>>;
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.refreshTimer));

    if (this.browser) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const read = await this.service.read();

    this.now.set(this.service.now());

    if (read.status === 'ready') {
      this.statuses.set(read.jobs);
      this.state.set('ready');
    } else if (this.state() === 'loading') {
      this.state.set('unavailable');
    }

    this.armRefreshTimer();
  }

  async run(job: DataJobKey): Promise<void> {
    if (this.runningJobs().has(job)) {
      return;
    }

    const label = DATA_JOBS.find((candidate) => candidate.key === job)?.label ?? job;

    this.runningJobs.update((jobs) => new Set(jobs).add(job));
    this.announcement.set(`Running ${label}.`);

    const result = await this.service.run(job);
    const words = resultWords(result);

    this.runningJobs.update((jobs) => new Set([...jobs].filter((key) => key !== job)));
    this.results.update((results) => ({ ...results, [job]: { ...words, toneClass: toneClass(words) } }));
    this.announcement.set(`${label}: ${words.headline}`);

    await this.refresh();
  }

  /**
   * Reads the jobs again when the nearest wait ends or a scheduled run should have happened, so a
   * button comes back and a new run shows without a reload. It reads rather than only moving the
   * clock because a run that was "running" when the page loaded has ended by now, and the page
   * should say how.
   */
  private armRefreshTimer(): void {
    clearTimeout(this.refreshTimer);

    // A read that was in flight when the page was left must not start the timer again.
    if (this.destroyRef.destroyed) {
      return;
    }

    const now = this.now();
    const statuses = this.statuses();
    const waitEnds = statuses.flatMap((job) => (job.wait ? [Date.parse(job.wait.retryAt)] : []));
    const scheduledRuns = DATA_JOBS.map((job) => nextRunAt(job.schedule, now - SCHEDULED_RUN_GRACE_MS) + SCHEDULED_RUN_GRACE_MS);
    const stillRunning = statuses.some((job) => job.lastScheduled?.outcome === 'running') ? [now + RUNNING_RECHECK_MS] : [];
    const nearest = Math.min(...[...waitEnds, ...scheduledRuns, ...stillRunning].filter((end) => end > now));

    this.refreshTimer = setTimeout(() => void this.refresh(), nearest - now + 250);
  }
}
