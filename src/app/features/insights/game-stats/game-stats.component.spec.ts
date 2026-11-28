import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { GameCounts } from '../../../../contracts/game-counts.model';
import { heroOf } from '../hero-matchup.fixtures';
import { statsHero, statsOf } from '../hero-stats.fixtures';
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

const HERO_STATS = statsOf([
  { name: 'S', heroes: [statsHero('storm', 40, 26, 13.4, 'S')] },
  { name: 'B', heroes: [statsHero('hela', 30, 15, 20.1)] },
]);
const ROSTER = [heroOf('storm', 'Storm', 'Duelist'), heroOf('hela', 'Hela', 'Duelist')];

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

  /** Answers a request, fails it when `answer` is `'failure'`, or leaves it waiting when it is `'pending'`. */
  function reply(request: ReturnType<HttpTestingController['expectOne']>, answer: unknown): void {
    if (answer === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else if (answer !== 'pending') {
      request.flush(answer as object);
    }
  }

  /** Opens the page and answers its requests: the counts, then the hero numbers and the roster behind the two leading heroes. */
  async function open(answer: unknown, heroes: { stats?: unknown; roster?: unknown } = {}): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/game-stats');

    reply(http.expectOne('/api/game-stats'), answer);
    reply(http.expectOne('/api/hero-stats'), heroes.stats ?? HERO_STATS);
    reply(http.expectOne('/api/heroes'), heroes.roster ?? ROSTER);
    await harness.fixture.whenStable();
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

    expect(element.querySelector('app-hub-tile')).toBeNull();
    expect(element.querySelector('.strip app-heartbeat-line[aria-hidden="true"]')).not.toBeNull();
    expect(text(element, '.strip__tile dt')).toEqual([
      'Matches · all seasons',
      'Matches · Season 10.5',
      'Players',
      'Earliest match',
    ]);
    expect(text(element, '.strip__tile dd')).toEqual(['733', '436', '7,674', 'Sep 20, 2026']);
  });

  it('charts matches and players per half-season, oldest first, with every figure in a hidden table', async () => {
    const element = await open(live);
    const table = element.querySelector('app-column-chart table') as HTMLTableElement;

    expect(element.querySelectorAll('table').length).toBe(1);
    expect(table.classList).toContain('visually-hidden');
    expect(element.querySelector('app-column-chart .plot')?.getAttribute('aria-hidden')).toBe('true');
    expect(table.querySelector('caption')?.textContent).toContain('Matches and players seen in each half-season');
    expect(Array.from(table.querySelectorAll('th')).every((header) => header.getAttribute('scope') !== null)).toBeTrue();
    expect(text(table, 'thead th')).toEqual(['Half-season', 'Matches counted', 'Players']);
    expect(
      Array.from(table.querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.children).map((cell) => cell.textContent?.trim()),
      ),
    ).toEqual([
      ['Season 10', '297', '3,165'],
      ['Season 10.5', '436', '4,546'],
    ]);
  });

  it('points the hidden table at the note on how matches and players are counted', async () => {
    const element = await open(live);
    const table = element.querySelector('app-column-chart table') as HTMLTableElement;
    const note = element.querySelector(`#${table.getAttribute('aria-describedby')}`);

    expect(note?.textContent).toContain('A player is counted once per half-season');
    expect(note?.textContent).toContain('A match is counted once however many players recorded it');
  });

  it('sets the hero picked most and the hero that wins most in a row of their own, each linking to its hero page', async () => {
    const element = await open(live);
    const spotlights = Array.from(element.querySelectorAll<HTMLAnchorElement>('app-hero-spotlight a'));

    expect(spotlights.map((link) => link.getAttribute('href'))).toEqual(['/heroes/hela', '/heroes/storm']);
    expect(spotlights.map((link) => link.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'Most picked Hela 20.1% pick rate 30 games Duelist',
      'Highest win rate Storm 65.0% win rate 40 games Duelist',
    ]);
    expect(spotlights.every((link) => link.querySelector('img')?.getAttribute('alt') === '')).toBeTrue();
  });

  it('keeps the four figures in a row of their own and puts the hero tiles in the row below', async () => {
    const element = await open(live);
    const figures = element.querySelector('.strip__figures') as HTMLElement;
    const spots = element.querySelector('.spots') as HTMLElement;

    expect(figures.contains(spots)).toBeFalse();
    expect(figures.querySelectorAll('.strip__tile').length).toBe(4);
    expect(spots.querySelectorAll('app-hero-spotlight').length).toBe(2);
    expect(figures.compareDocumentPosition(spots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('holds the heroes room, as hidden blocks with no link, while their numbers load', async () => {
    const element = await open(live, { stats: 'pending' });

    expect(element.querySelectorAll('.spots[aria-hidden="true"] .spot--pending[aria-hidden="true"]').length).toBe(2);
    expect(element.querySelector('app-hero-spotlight a')).toBeNull();
    expect(text(element, '.strip__tile dt')).toContain('Players');
  });

  const WITHOUT_HEROES: [string, unknown][] = [
    ['has no hero with enough games yet', statsOf([])],
    ['cannot be read', 'failure'],
  ];

  for (const [name, stats] of WITHOUT_HEROES) {
    it(`draws only the figures when the hero numbers ${name}`, async () => {
      const element = await open(live, { stats });

      expect(element.querySelector('.spots')).toBeNull();
      expect(text(element, '.strip__tile dd')).toContain('7,674');
    });
  }

  it('names its "How these are counted" disclosure for what it explains, for screen readers', async () => {
    const element = await open(live);

    expect(text(element, '.stat-how > summary')).toEqual(['How these are counted for matches and players']);
  });

  it('names where the numbers come from and shows nothing from outside the app', async () => {
    const element = await open(live);

    expect(text(element, '.stat-how .stat-note')[0]).toBe('Counted from RivalsPulse overlay uploads: what the app has recorded, not everyone who plays Marvel Rivals.');
    expect(Array.from(element.querySelectorAll('a')).every((link) => link.getAttribute('href')?.startsWith('/heroes/'))).toBeTrue();
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
