import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import {
  DATA_JOBS,
  type DataJobDefinition,
  type DataJobKey,
  type DataJobKind,
  type DataJobStatus,
} from '../../../../contracts/admin-data-jobs.model';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { describeDetail, describeRun, utcLabel, type RunWords } from './data-jobs.describe';
import { DataJobsService, type DataJobRunResult } from './data-jobs.service';

/** Words for a run, with the class that colours them and the time it began. */
interface RunView extends RunWords {
  toneClass: string;
  startedAt: string;
  startedLabel: string;
}

interface ResultView extends RunWords {
  toneClass: string;
}

interface JobRow extends Omit<DataJobDefinition, 'key'> {
  key: DataJobKey;
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

const toneClass = (words: RunWords): string => `jobs__tone--${words.tone}`;

function runView(words: RunWords, startedAt: string): RunView {
  return { ...words, toneClass: toneClass(words), startedAt, startedLabel: utcLabel(startedAt) };
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
        headline: `${result.busy.error} It did not start. Try again after ${utcLabel(result.busy.retryAt)}.`,
        note: null,
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
  imports: [StatePanelComponent],
  templateUrl: './data-jobs-page.component.html',
  styleUrls: ['../../../shared/styles/guide-article.css', './data-jobs-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataJobsPageComponent {
  private readonly service = inject(DataJobsService);
  private readonly statuses = signal<readonly DataJobStatus[]>([]);
  private readonly now = signal(this.service.now());
  private readonly runningJobs = signal<ReadonlySet<DataJobKey>>(new Set());
  private readonly results = signal<Readonly<Partial<Record<DataJobKey, ResultView>>>>({});
  private timer: ReturnType<typeof setTimeout> | undefined;

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
          scheduled: status?.lastScheduled ? runView(describeRun(status.lastScheduled), status.lastScheduled.startedAt) : null,
          manual: status?.lastManual ? runView(describeRun(status.lastManual), status.lastManual.startedAt) : null,
          result: results[job.key] ?? null,
          running: running.has(job.key),
          hint: wait
            ? `${wait.reason === 'running' ? 'Already running.' : 'Ran a moment ago.'} Available again after ${utcLabel(wait.retryAt)}.`
            : null,
        };
      }),
    }));
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));

    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    const read = await this.service.read();

    if (read.status === 'ready') {
      this.statuses.set(read.jobs);
      this.now.set(this.service.now());
      this.state.set('ready');
      this.armWaitTimer(read.jobs);
    } else if (this.state() === 'loading') {
      this.state.set('unavailable');
    }
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

  /** Wakes the page once when the nearest wait ends, so its button comes back without a reload. */
  private armWaitTimer(jobs: readonly DataJobStatus[]): void {
    clearTimeout(this.timer);

    const now = this.now();
    const ends = jobs.flatMap((job) => (job.wait ? [Date.parse(job.wait.retryAt)] : [])).filter((end) => end > now);

    if (ends.length > 0) {
      this.timer = setTimeout(() => {
        this.now.set(this.service.now());
        this.armWaitTimer(this.statuses());
      }, Math.min(...ends) - now + 250);
    }
  }
}
