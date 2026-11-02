import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { GameComparison, GameStatsResponse } from '../../../../contracts/game-stats.model';
import { GameStatsPageComponent } from './game-stats-page.component';

function game(name: string, category: string, overrides: Partial<GameComparison> = {}): GameComparison {
  return {
    appId: 1,
    name,
    category,
    currentPlayers: 43194,
    dailyPeak: 118674,
    allTimePeak: 644269,
    steamDailyRank: '#15',
    topSellerRank: '#4',
    twitchViewers: 0,
    reviewSummary: '',
    sourceUrl: 'https://steamdb.info/app/1/charts/',
    ...overrides,
  };
}

const live: GameStatsResponse = {
  snapshotDate: 'November 2, 2026',
  fetchedAt: '2026-11-02T08:51:52.762Z',
  currentPlayerSource: 'Valve',
  currentPlayerSourceUrl: 'https://api.steampowered.com/',
  snapshot: { snapshotDate: 'November 2, 2026', capturedAt: '2026-11-02T08:10:03.826Z', persisted: true },
  previousSnapshot: { snapshotDate: 'November 2, 2026', capturedAt: '2026-11-02T07:10:04.228Z', persisted: true },
  games: [
    game('Marvel Rivals', 'Hero shooter', {
      comparison: {
        previousCapturedAt: '2026-11-02T07:10:04.228Z',
        currentPlayers: { previous: 39802, change: 3392, changePercent: 8.52, trend: 'up' },
        dailyPeak: { previous: 118674, change: 0, changePercent: 0, trend: 'flat' },
        allTimePeak: { previous: 644269, change: 0, changePercent: 0, trend: 'flat' },
        steamDailyRank: { previous: '#17', positionsChanged: 2, trend: 'up' },
        topSellerRank: { previous: '#4', trend: 'flat' },
        read: 'Unused',
      },
    }),
    game('Overwatch', 'Hero shooter', { currentPlayers: 59207, steamDailyRank: '#14', topSellerRank: '#19' }),
  ],
};

describe('GameStatsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'game-stats', component: GameStatsPageComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /** Opens the page and answers its request, or leaves it waiting when `answer` is `'pending'`. */
  async function open(answer: unknown): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/game-stats');

    const request = http.expectOne('/api/game-stats');

    if (answer === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else if (answer !== 'pending') {
      request.flush(answer as object);
    }

    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');

    return element;
  }

  const text = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  it('says it is loading, without announcing it, while the numbers are on their way', async () => {
    const element = await open('pending');

    expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading game stats');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector('[aria-live]')).toBeNull();
    expect(element.querySelectorAll('.card h2').length).toBe(1);
  });

  it('draws one table with a caption, a note on what changes compare with, and a scope on every header', async () => {
    const element = await open(live);
    const table = element.querySelector('table') as HTMLTableElement;
    const headers = Array.from(table.querySelectorAll('th'));

    expect(element.querySelectorAll('table').length).toBe(1);
    expect(table.querySelector('caption')?.textContent).toContain('Steam players, peaks and ranks');
    expect(element.querySelector(`#${table.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'Changes compare with the previous snapshot',
    );
    expect(headers.every((header) => header.getAttribute('scope') !== null)).toBeTrue();
    expect(text(table, 'thead th')).toEqual([
      'Game',
      'Players now',
      '24h peak',
      'All-time peak',
      'Daily rank',
      'Top sellers',
    ]);
    expect(text(table, 'tbody .game-name')).toEqual(['Marvel Rivals', 'Overwatch']);
    expect(text(table, 'tbody th small')).toEqual(['Hero shooter', 'Hero shooter']);
  });

  it('keeps the table in a labelled, focusable region that can scroll on a narrow screen', async () => {
    const element = await open(live);
    const region = element.querySelector('.scroll') as HTMLElement;

    expect(region.getAttribute('role')).toBe('region');
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(element.querySelector(`#${region.getAttribute('aria-labelledby')}`)?.textContent).toContain(
      'Where Marvel Rivals sits',
    );
  });

  it('shows a change only where a value moved, and says it in words for a screen reader', async () => {
    const element = await open(live);

    expect(text(element, 'tbody tr:first-child .delta [aria-hidden="true"]')).toEqual(['+3,392 (+8.52%)', '▲2']);
    expect(text(element, 'tbody tr:first-child .delta .visually-hidden')).toEqual([
      'up 3,392, 8.52 percent',
      'up 2 places',
    ]);
    expect(text(element, 'tbody tr:last-child .delta')).toEqual([]);
    expect(element.textContent).not.toContain('Unchanged');
  });

  it('fills the Marvel Rivals row and nobody else', async () => {
    const element = await open(live);

    expect(Array.from(element.querySelectorAll('tbody tr')).map((row) => row.classList.contains('subject'))).toEqual([
      true,
      false,
    ]);
  });

  it('puts no link in a table row, and none of the removed sections on the page', async () => {
    const element = await open(live);

    expect(element.querySelector('table a')).toBeNull();
    expect(element.querySelector('.hero-metrics, .read-panel, .source-panel')).toBeNull();
    expect(element.textContent).not.toContain('How to keep this page fresh');
    expect(element.textContent).not.toContain('top sellers snapshot');
  });

  it('lists the three launch milestones and the Steam-only caveat', async () => {
    const element = await open(live);

    expect(text(element, 'dd')).toEqual(['10M', '20M', '40M+']);
    expect(text(element, 'dt')).toEqual([
      'Players in 72 hours',
      'Players by December 17, 2024',
      'Players by February 2025 (NetEase, all platforms)',
    ]);
    expect(text(element, '.note')[1]).toContain('Steam is only one slice of the player base');
  });

  it('names its four sources, each opening in a new tab and saying so', async () => {
    const element = await open(live);
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a'));

    expect(links.length).toBe(4);
    expect(links.every((link) => link.target === '_blank' && link.rel.includes('noopener'))).toBeTrue();
    expect(links.every((link) => link.querySelector('.visually-hidden')?.textContent?.includes('opens in a new tab'))).toBeTrue();
    expect(text(element, '.sources a').map((label) => label.replace(' (opens in a new tab)', ''))).toEqual([
      'Steam current-players API',
      'SteamDB',
      'Steam most played',
      'Wikipedia (milestones)',
    ]);
  });

  it('is a page inside the shell: one h1, no main landmark, no live region', async () => {
    const element = await open(live);

    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('[aria-live], [role="status"]')).toBeNull();
  });

  it('names the snapshot, the fetch time and the comparison in one meta line', async () => {
    const element = await open(live);

    expect(text(element, '.meta')).toEqual([
      'Snapshot November 2, 2026 · Live players fetched Nov 2, 8:51 AM UTC · Compared with Nov 2, 7:10 AM UTC',
    ]);
    expect(element.querySelector('app-notice')).toBeNull();
  });

  it('shows the saved snapshot behind a notice when the live numbers fail', async () => {
    const element = await open('failure');

    expect(text(element, 'app-notice')).toEqual([
      'Live numbers could not be loaded. Showing a saved snapshot from June 19, 2026.',
    ]);
    expect(text(element, '.meta')).toEqual(['Saved snapshot June 19, 2026']);
    expect(element.textContent).not.toContain('Static snapshot');
    expect(text(element, 'tbody .game-name')[0]).toBe('Marvel Rivals');
    expect(element.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('treats an answer that is not game stats as a failure', async () => {
    const element = await open({ games: 'none' });

    expect(text(element, 'app-notice').length).toBe(1);
    expect(element.querySelectorAll('tbody tr').length).toBe(5);
  });

  it('says there are no games to compare, and draws no table, when the answer holds none', async () => {
    const element = await open({ ...live, games: [] });

    expect(text(element, 'app-state-panel h2')).toEqual(['No games to compare yet']);
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });
});
