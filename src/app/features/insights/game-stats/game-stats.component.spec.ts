import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { GameCounts } from '../../../../contracts/game-counts.model';
import { GameStatsComponent } from './game-stats.component';
import { isGameCounts } from './game-stats.service';

const live: GameCounts = {
  matches: 733,
  players: 7674,
  since: '2026-09-20T02:12:49.000Z',
  halfSeasons: [
    { halfSeason: 10.5, matches: 436, players: 4546 },
    { halfSeason: 10, matches: 297, players: 3165 },
  ],
};

describe('GameStatsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'game-stats', component: GameStatsComponent }]),
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

  it('says it is loading, without announcing it, while the counts are on their way', async () => {
    const element = await open('pending');

    expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading game stats');
    expect(element.querySelector('table, .strip')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the totals as one strip of figures over a heartbeat line, each named by what it counts', async () => {
    const element = await open(live);

    expect(element.querySelector('app-hub-tile, img')).toBeNull();
    expect(element.querySelector('.strip app-heartbeat-line[aria-hidden="true"]')).not.toBeNull();
    expect(text(element, '.strip__tile dt')).toEqual([
      'Matches · all seasons',
      'Matches · Season 10.5',
      'Players',
      'Earliest match',
    ]);
    expect(text(element, '.strip__tile dd')).toEqual(['733', '436', '7,674', 'Sep 20, 2026']);
  });

  it('draws one table of half-seasons with a caption, a note and a scope on every header', async () => {
    const element = await open(live);
    const table = element.querySelector('table') as HTMLTableElement;

    expect(element.querySelectorAll('table').length).toBe(1);
    expect(table.querySelector('caption')?.textContent).toContain('Matches and players seen in each half-season');
    expect(element.querySelector(`#${table.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'A player is counted once per half-season',
    );
    expect(element.querySelector(`#${table.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'A match is counted once however many players recorded it',
    );
    expect(Array.from(table.querySelectorAll('th')).every((header) => header.getAttribute('scope') !== null)).toBeTrue();
    expect(text(table, 'thead th')).toEqual(['Half-season', 'Matches counted', 'Players']);
    expect(
      Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.children).map((cell) => cell.textContent?.trim()),
      ),
    ).toEqual([
      ['Season 10.5', '436', '4,546'],
      ['Season 10', '297', '3,165'],
    ]);
  });

  it('names its "How these are counted" disclosure for what it explains, for screen readers', async () => {
    const element = await open(live);

    expect(text(element, '.stat-how > summary')).toEqual(['How these are counted for matches and players']);
  });

  it('names where the numbers come from and shows nothing from outside the app', async () => {
    const element = await open(live);

    expect(text(element, '.stat-how .stat-note')[0]).toBe('Counted from RivalsPulse overlay uploads: what the app has recorded, not everyone who plays Marvel Rivals.');
    expect(element.querySelector('a')).toBeNull();
    expect(element.textContent).not.toMatch(/steam|netease|wikipedia|milestone/i);
  });

  it('sits inside the Stats hub page: no h1 of its own, no main landmark, no live region', async () => {
    const element = await open(live);

    expect(element.querySelector('h1')).toBeNull();
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('[aria-live], [role="status"]')).toBeNull();
  });

  it('says plainly that the counts could not be loaded when the request fails', async () => {
    const element = await open('failure');

    expect(text(element, 'app-state-panel h2')).toEqual(['Game stats could not be loaded']);
    expect(element.querySelector('table, .strip, .stat-how')).toBeNull();
  });

  const NOT_COUNTS: [string, unknown][] = [
    ['has no counts at all', { games: 'none' }],
    ['has a null total', { ...live, players: null }],
    ['has a half-season with no figures', { ...live, halfSeasons: [{ halfSeason: 10 }] }],
  ];

  for (const [name, answer] of NOT_COUNTS) {
    it(`treats an answer that ${name} as a failure`, async () => {
      const element = await open(answer);

      expect(text(element, 'app-state-panel h2')).toEqual(['Game stats could not be loaded']);
    });
  }

  it('says no matches are counted yet, and draws no table, before the first upload', async () => {
    const element = await open({ matches: 0, players: 0, since: null, halfSeasons: [] });

    expect(text(element, 'app-state-panel h2')).toEqual(['No matches counted yet']);
    expect(element.querySelector('table, .strip')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
  });
});

describe('isGameCounts', () => {
  it('accepts the answer the API gives and refuses anything off-shape', () => {
    expect(isGameCounts(live)).toBeTrue();
    expect(isGameCounts({ ...live, since: null })).toBeTrue();
    expect(isGameCounts(null)).toBeFalse();
    expect(isGameCounts([])).toBeFalse();
    expect(isGameCounts({ ...live, matches: '733' })).toBeFalse();
    expect(isGameCounts({ ...live, since: 'yesterday' })).toBeFalse();
    expect(isGameCounts({ ...live, halfSeasons: 'none' })).toBeFalse();
  });
});
