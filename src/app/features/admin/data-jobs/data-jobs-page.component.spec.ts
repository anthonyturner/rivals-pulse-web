import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { DATA_JOBS, type DataJobKey, type DataJobRun, type DataJobStatus } from '../../../../contracts/admin-data-jobs.model';
import { DataJobsPageComponent } from './data-jobs-page.component';
import { DataJobsService, type DataJobRunResult, type DataJobsRead } from './data-jobs.service';

const NOW = Date.parse('2026-11-04T10:00:00.000Z');

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

  async function open(jobs: DataJobStatus[] = DATA_JOBS.map((job) => status(job.key))): Promise<void> {
    read = jasmine.createSpy('read').and.resolveTo({ status: 'ready', jobs } satisfies DataJobsRead);
    runJob = jasmine.createSpy('run');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DataJobsService, useValue: { now: () => NOW, read, run: runJob } },
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

  it('lists the five rebuilds and the two syncs, and says uploads cannot be forced', async () => {
    await open();

    expect(el().querySelectorAll('.jobs__card').length).toBe(7);
    expect(el().querySelector('.jobs__note')?.textContent).toContain('Player uploads cannot be forced');
    expect(Array.from(el().querySelectorAll('.jobs__group-title')).map((title) => title.textContent?.trim())).toEqual([
      'Rebuilds',
      'Syncs',
      'Run from GitHub',
    ]);
  });

  it('shows each job\'s last scheduled and last manual run, and an unfinished one as not finished', async () => {
    await open(
      DATA_JOBS.map((job) =>
        job.key === 'game-stats'
          ? status(job.key, {
              lastScheduled: run({ outcome: 'failed', message: 'Could not store the game stats' }),
              lastManual: run({ outcome: 'unfinished', finishedAt: null, startedAt: '2026-11-04T08:00:00.000Z' }),
            })
          : status(job.key),
      ),
    );

    const text = card('Game stats').textContent ?? '';

    expect(text).toContain('Last scheduled run');
    expect(text).toContain('Failed.');
    expect(text).toContain('Could not store the game stats');
    expect(text).toContain('Last manual run');
    expect(text).toContain('Did not finish.');
    expect(text).toContain('2026-11-04 08:00 UTC');
    expect(card('Hero stats').textContent).toContain('None yet.');
  });

  it('starts a job on a click, tells a capture stored with fallback numbers as a warning, and reads the jobs again', async () => {
    await open();
    runJob.and.resolveTo({
      status: 'finished',
      run: {
        job: 'game-stats',
        outcome: 'succeeded',
        recorded: true,
        detail: { result: 'stored-with-fallbacks', capturedAt: '2026-11-04T10:00:00.000Z', games: 5, fallbackGames: 3 },
      },
    });

    button('Game stats').click();
    await settle();

    const result = card('Game stats').querySelector('.jobs__result') as HTMLElement;

    expect(runJob).toHaveBeenCalledOnceWith('game-stats');
    expect(read).toHaveBeenCalledTimes(2);
    expect(result.textContent).toContain('Steam did not answer for 3 of 5 games');
    expect(result.textContent).not.toMatch(/succeeded/i);
    expect(result.className).toContain('jobs__tone--warning');
    expect(el().querySelector('[role="status"].visually-hidden')?.textContent).toContain('Steam did not answer');
  });

  it('says plainly when the hour was already captured', async () => {
    await open();
    runJob.and.resolveTo({
      status: 'finished',
      run: {
        job: 'game-stats',
        outcome: 'succeeded',
        recorded: true,
        detail: { result: 'already-captured', capturedAt: '2026-11-04T10:02:00.000Z', games: 5, fallbackGames: 0 },
      },
    });

    button('Game stats').click();
    await settle();

    expect(card('Game stats').querySelector('.jobs__result')?.textContent).toContain(
      'Nothing new was stored: this hour was already captured at 2026-11-04 10:02 UTC.',
    );
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
      'It did not start. Try again after 2026-11-04 10:01:00 UTC.',
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
          job.key === 'game-stats'
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
    expect(card('Home news').textContent).toContain('Available again after 2026-11-04 10:05:00 UTC.');
    expect(button('Home news').getAttribute('aria-describedby')).toBe('hint-home-news');
    expect(button('Game stats').disabled).toBeFalse();
  });

  it('shows an error with a way to try again when the jobs cannot be read', async () => {
    read = jasmine.createSpy('read').and.resolveTo({ status: 'unavailable' } satisfies DataJobsRead);
    runJob = jasmine.createSpy('run');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DataJobsService, useValue: { now: () => NOW, read, run: runJob } },
      ],
    });
    fixture = TestBed.createComponent(DataJobsPageComponent);
    await settle();

    expect(el().textContent).toContain('The jobs could not be read right now.');
    expect(el().querySelectorAll('.jobs__card').length).toBe(0);

    read.and.resolveTo({ status: 'ready', jobs: DATA_JOBS.map((job) => status(job.key)) });
    (el().querySelector('app-state-panel button') as HTMLButtonElement).click();
    await settle();

    expect(el().querySelectorAll('.jobs__card').length).toBe(7);
  });
});
