import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DATA_JOBS, type DataJobKey, type DataJobRun, type DataJobStatus } from '../../../../contracts/admin-data-jobs.model';
import { DataJobsPageComponent } from './data-jobs-page.component';
import { DataJobsService, type DataJobRunResult, type DataJobsRead } from './data-jobs.service';

const NOW = Date.parse('2026-11-04T10:00:00.000Z');
const MINUTE = 60_000;

const run = (overrides: Partial<DataJobRun> = {}): DataJobRun => ({
  outcome: 'succeeded',
  startedAt: '2026-11-04T09:07:00.000Z',
  finishedAt: '2026-11-04T09:07:01.000Z',
  detail: null,
  message: null,
  ...overrides,
});

const status = (job: DataJobKey, overrides: Partial<DataJobStatus> = {}): DataJobStatus => ({
  job,
  lastScheduled: run(),
  lastManual: null,
  wait: null,
  ...overrides,
});

describe('DataJobsPageComponent', () => {
  let read: jasmine.Spy<() => Promise<DataJobsRead>>;
  let runJob: jasmine.Spy<(job: DataJobKey) => Promise<DataJobRunResult>>;
  let fixture: ComponentFixture<DataJobsPageComponent>;
  let clockNow: number;

  beforeEach(() => {
    clockNow = NOW;
  });

  async function open(jobs: DataJobStatus[] = DATA_JOBS.map((job) => status(job.key))): Promise<void> {
    read = jasmine.createSpy('read').and.resolveTo({ status: 'ready', jobs } satisfies DataJobsRead);
    runJob = jasmine.createSpy('run');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DataJobsService, useValue: { now: () => clockNow, tickingClock: DataJobsService.prototype.tickingClock, read, run: runJob } },
      ],
    });
    fixture = TestBed.createComponent(DataJobsPageComponent);
    await settle();
  }

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const card = (label: string): HTMLElement =>
    Array.from(el().querySelectorAll<HTMLElement>('.jobs__card')).find(
      (item) => item.querySelector('.jobs__name')?.textContent?.trim() === label,
    ) as HTMLElement;
  const button = (label: string): HTMLButtonElement => card(label).querySelector('button') as HTMLButtonElement;

  it('lists the five rebuilds and the one sync, and says uploads cannot be forced', async () => {
    await open();

    expect(el().querySelectorAll('.jobs__card').length).toBe(6);
    expect(el().querySelector('.jobs__note')?.textContent).toContain('Player uploads cannot be forced');
    expect(Array.from(el().querySelectorAll('.jobs__group-title')).map((title) => title.textContent?.trim())).toEqual([
      'Rebuilds',
      'Syncs',
      'Run from GitHub',
    ]);
  });

  it('shows the time left and the time of the next scheduled run on every job', async () => {
    await open();

    const next = (label: string): string[] =>
      [card(label).querySelector('.jobs__countdown'), card(label).querySelector('.jobs__runs time')].map((item) => item?.textContent?.trim() ?? '');

    expect(next('Hero stats')).toEqual(['In 7m 0s', 'Nov 4, 2026, 5:07 AM EST']);
    expect(next('Hero pairs')).toEqual(['In 43m 0s', 'Nov 4, 2026, 5:43 AM EST']);
    expect(next('Home news')).toEqual(['In 17h 0m', 'Nov 4, 2026, 10:00 PM EST']);
    expect(card('Hero stats').querySelector('.jobs__runs time')?.getAttribute('datetime')).toBe('2026-11-04T10:07:00.000Z');
  });

  it('shows the next run of the GitHub workflows, says they can run late, and links to them', async () => {
    await open();

    const links = Array.from(el().querySelectorAll<HTMLElement>('.jobs__link'));

    expect(links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Publish Pulse Atlas (opens GitHub in a new tab) Next scheduled run in 2h 17m, Nov 4, 2026, 7:17 AM EST',
      'Sync new heroes (opens GitHub in a new tab) Next scheduled run in 18h 30m, Nov 4, 2026, 11:30 PM EST',
    ]);
    expect(links[0].querySelector('a')?.getAttribute('href')).toBe(
      'https://github.com/anthonyturner/rivals-pulse-web/actions/workflows/pulse-atlas.yml',
    );
    expect(el().textContent).toContain('GitHub can start a scheduled run hours late or skip it');
  });

  it('counts down while open, moves on to the following run, and reads the jobs again after one is due', async () => {
    jasmine.clock().install();

    try {
      await open();

      const countdown = (): string | null | undefined => card('Hero stats').querySelector('.jobs__countdown')?.textContent;

      expect(countdown()).toBe('In 7m 0s');
      expect(read).toHaveBeenCalledTimes(1);

      clockNow += MINUTE;
      jasmine.clock().tick(1000);
      await settle();
      expect(countdown()).toBe('In 6m 0s');

      clockNow = Date.parse('2026-11-04T10:07:00.000Z');
      jasmine.clock().tick(1000);
      await settle();
      expect(countdown()).toBe('In 1h 0m');

      clockNow += 31_000;
      jasmine.clock().tick(7 * MINUTE + 30_250 - 1000);
      await settle();
      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
    }
  });

  it('stops reading the jobs once the page is left, even when a read was still on its way', async () => {
    jasmine.clock().install();

    try {
      await open();

      let answer: (value: DataJobsRead) => void = () => undefined;

      read.and.returnValue(new Promise<DataJobsRead>((resolve) => (answer = resolve)));
      jasmine.clock().tick(7 * MINUTE + 30_250);
      expect(read).toHaveBeenCalledTimes(2);

      fixture.destroy();
      answer({ status: 'ready', jobs: DATA_JOBS.map((job) => status(job.key)) });
      await Promise.resolve();
      await Promise.resolve();
      jasmine.clock().tick(24 * 60 * MINUTE);

      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('keeps reading after a failed read, and reads again soon while a scheduled run is still going', async () => {
    jasmine.clock().install();

    try {
      await open(
        DATA_JOBS.map((job) =>
          status(job.key, job.key === 'home-news' ? { lastScheduled: run({ outcome: 'running', finishedAt: null }) } : {}),
        ),
      );
      read.and.resolveTo({ status: 'unavailable' });

      jasmine.clock().tick(15_250);
      await settle();
      expect(read).toHaveBeenCalledTimes(2);

      jasmine.clock().tick(7 * MINUTE + 30_250);
      await settle();
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      fixture.destroy();
      jasmine.clock().uninstall();
    }
  });

  it('marks up the countdown without a live region, so it is not read out every second', async () => {
    await open();

    expect(el().querySelector('.jobs__countdown')?.closest('[role], [aria-live]')).toBeNull();
    expect(el().querySelectorAll('[role="status"]').length).toBe(1);
  });

  it('says when a change shows, once for the page', async () => {
    await open();

    const notes = Array.from(el().querySelectorAll('.jobs__note')).map((note) => note.textContent ?? '');

    expect(notes.filter((text) => text.includes('web cache')).length).toBe(1);
    expect(notes.join(' ')).toContain('up to 5 minutes');
    expect(notes.join(' ')).toContain('up to an hour');
    expect(notes.join(' ')).toContain('needs a reload');
  });

  it('keeps what each job updates closed, after the run status and the button', async () => {
    await open();

    for (const job of DATA_JOBS) {
      const jobCard = card(job.label);
      const more = jobCard.querySelector('details.jobs__more') as HTMLDetailsElement;

      expect(more.open).withContext(job.label).toBeFalse();
      expect(more.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        `What this updates (${job.label})`,
      );
      expect(
        jobCard.querySelector('.jobs__runs')!.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).withContext(`${job.label} runs`).toBeTruthy();
      expect(
        jobCard.querySelector('.jobs__actions')!.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).withContext(`${job.label} button`).toBeTruthy();
    }
  });

  it('shows each job\'s own text: what it updates, where, the Atlas files, the caveat and an example', async () => {
    await open();

    for (const job of DATA_JOBS) {
      const text = card(job.label).querySelector('.jobs__feeds')?.textContent ?? '';

      expect(text).withContext(job.label).toContain(job.updates);
      expect(text).withContext(job.label).toContain(job.example);

      if (job.caveat) {
        expect(text).withContext(job.label).toContain(job.caveat);
      }

      for (const file of job.atlasFiles) {
        expect(text).withContext(job.label).toContain(file);
      }
    }
  });

  it('links each page a job feeds, in a new tab', async () => {
    await open();

    const links = Array.from(card('Hero stats').querySelectorAll<HTMLAnchorElement>('.jobs__pages a'));

    expect(links.map((link) => link.getAttribute('href'))).toContain('/win-rates');
    expect(links.map((link) => link.getAttribute('href'))).toContain('/stats/matchups');
    expect(links.every((link) => link.target === '_blank' && link.rel === 'noopener')).toBeTrue();
    expect(links[0].textContent).toContain('(opens in a new tab)');

    for (const [label, path] of [
      ['Community matches', '/stats'],
      ['Play time', '/stats'],
      ['Hero pairs', '/stats/team-comps'],
    ]) {
      const hrefs = Array.from(card(label).querySelectorAll<HTMLAnchorElement>('.jobs__pages a')).map((link) =>
        link.getAttribute('href'),
      );

      expect(hrefs).withContext(label).toEqual([path]);
      expect(card(label).querySelector('.jobs__feeds')?.textContent).withContext(label).not.toContain('No page on the site yet.');
    }
  });

  it('shows each job\'s last scheduled and last manual run, and an unfinished one as not finished', async () => {
    await open(
      DATA_JOBS.map((job) =>
        job.key === 'home-news'
          ? status(job.key, {
              lastScheduled: run({ outcome: 'failed', message: 'Could not read the official site' }),
              lastManual: run({ outcome: 'unfinished', finishedAt: null, startedAt: '2026-11-04T08:00:00.000Z' }),
            })
          : status(job.key),
      ),
    );

    const text = card('Home news').textContent ?? '';

    expect(text).toContain('Last scheduled run');
    expect(text).toContain('Failed.');
    expect(text).toContain('Could not read the official site');
    expect(text).toContain('Last manual run');
    expect(text).toContain('Did not finish.');
    expect(text).toContain('Nov 4, 2026, 3:00 AM EST');
    expect(card('Hero stats').textContent).toContain('None yet.');
  });

  it('starts a job on a click, tells the run by what it came to, and reads the jobs again', async () => {
    await open();
    runJob.and.resolveTo({
      status: 'finished',
      run: { job: 'home-news', outcome: 'succeeded', recorded: true, detail: { result: 'news-synced', cards: 4 } },
    });

    button('Home news').click();
    await settle();

    const result = card('Home news').querySelector('.jobs__result') as HTMLElement;

    expect(runJob).toHaveBeenCalledOnceWith('home-news');
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.textContent).toContain('Home news refreshed with 4 cards.');
    expect(result.className).toContain('jobs__tone--good');
    expect(el().querySelector('[role="status"].visually-hidden')?.textContent).toContain('Home news refreshed');
  });

  it('shows a failed job as failed, and says when its audit row could not be written', async () => {
    await open();
    runJob.and.resolveTo({
      status: 'finished',
      run: {
        job: 'home-news',
        outcome: 'failed',
        recorded: false,
        detail: { result: 'failed', message: 'Reading the official site took longer than 30 seconds; the earlier news is kept' },
      },
    });

    button('Home news').click();
    await settle();

    const result = card('Home news').querySelector('.jobs__result') as HTMLElement;

    expect(result.textContent).toContain('took longer than 30 seconds');
    expect(result.textContent).toContain('could not be written to the audit log');
    expect(result.className).toContain('jobs__tone--bad');
  });

  it('says a job that was refused did not start, with when to try again', async () => {
    await open();
    runJob.and.resolveTo({
      status: 'busy',
      busy: { error: 'This job ran a moment ago.', reason: 'cooldown', retryAt: '2026-11-04T10:01:00.000Z' },
    });

    button('Hero pairs').click();
    await settle();

    expect(card('Hero pairs').querySelector('.jobs__result')?.textContent).toContain(
      'It did not start. Try again after Nov 4, 2026, 5:01:00 AM EST.',
    );
  });

  it('says a refused request did not start the job, and does not call it unknown', async () => {
    await open();
    runJob.and.resolveTo({ status: 'refused' });

    button('Home news').click();
    await settle();

    const result = card('Home news').querySelector('.jobs__result') as HTMLElement;

    expect(result.textContent).toContain('The request was refused, so the job did not start.');
    expect(result.textContent).not.toContain('not known');
  });

  it('reads the jobs again when a wait ends, so a run that was running is shown as it ended', async () => {
    jasmine.clock().install();

    try {
      await open(
        DATA_JOBS.map((job) =>
          job.key === 'home-news'
            ? status(job.key, { wait: { reason: 'running', retryAt: '2026-11-04T10:00:02.000Z' } })
            : status(job.key),
        ),
      );
      expect(read).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(2300);
      await settle();

      expect(read).toHaveBeenCalledTimes(2);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('does not claim a job ran when no readable answer came back', async () => {
    await open();
    runJob.and.resolveTo({ status: 'unknown' });

    button('Play time').click();
    await settle();

    expect(card('Play time').querySelector('.jobs__result')?.textContent).toContain('not known whether the job ran');
  });

  it('turns a job off while it is waiting out its cooldown, and says until when', async () => {
    await open(
      DATA_JOBS.map((job) =>
        job.key === 'home-news'
          ? status(job.key, { wait: { reason: 'cooldown', retryAt: '2026-11-04T10:05:00.000Z' } })
          : status(job.key, { wait: { reason: 'cooldown', retryAt: '2026-11-04T09:59:00.000Z' } }),
      ),
    );

    expect(button('Home news').disabled).toBeTrue();
    expect(card('Home news').textContent).toContain('Available again after Nov 4, 2026, 5:05:00 AM EST.');
    expect(button('Home news').getAttribute('aria-describedby')).toBe('hint-home-news');
    expect(button('Hero stats').disabled).toBeFalse();
  });

  it('shows an error with a way to try again when the jobs cannot be read', async () => {
    read = jasmine.createSpy('read').and.resolveTo({ status: 'unavailable' } satisfies DataJobsRead);
    runJob = jasmine.createSpy('run');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: DataJobsService, useValue: { now: () => NOW, tickingClock: DataJobsService.prototype.tickingClock, read, run: runJob } },
      ],
    });
    fixture = TestBed.createComponent(DataJobsPageComponent);
    await settle();

    expect(el().textContent).toContain('The jobs could not be read right now.');
    expect(el().querySelectorAll('.jobs__card').length).toBe(0);

    read.and.resolveTo({ status: 'ready', jobs: DATA_JOBS.map((job) => status(job.key)) });
    (el().querySelector('app-state-panel button') as HTMLButtonElement).click();
    await settle();

    expect(el().querySelectorAll('.jobs__card').length).toBe(6);
  });
});
