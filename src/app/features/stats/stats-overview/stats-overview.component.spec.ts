import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import type { CommunityInsights } from '../../../../contracts/community-insights.model';
import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import type { GameCounts } from '../../../../contracts/game-counts.model';
import { heartbeatRate } from '../../../core/circuit/heartbeat-line';
import { HeartbeatLineComponent } from '../../../shared/components/heartbeat-line/heartbeat-line.component';
import { StatsOverviewComponent } from './stats-overview.component';

const SEASON = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const COUNTS: GameCounts = {
  matches: 799,
  players: 8349,
  since: '2026-09-20T02:12:49.000Z',
  halfSeasons: [
    { halfSeason: 10.5, matches: 502, players: 5227 },
    { halfSeason: 10, matches: 297, players: 3165 },
  ],
};
const MATCHES: CommunityMatches = {
  status: 'ready',
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [SEASON],
  halfSeason: SEASON,
  inPlaceOf: null,
  matchesCounted: 502,
  maps: [
    { map: 'Yggdrasill path', winRate: 69 },
    { map: "Birnin t'challa", winRate: 67 },
    { map: 'Hall of Djalia', winRate: 64 },
    { map: 'Central park', winRate: 50 },
    { map: 'Lower Manhattan', winRate: 42 },
    { map: 'Midtown', winRate: 41 },
    { map: 'Spider-islands', winRate: 41 },
  ],
  mapsBelowMinimum: [],
  modeMix: [
    { playModeId: 0, mode: 'Quick Match', share: 76, averageLengthMinutes: 10 },
    { playModeId: 1, mode: 'Competitive', share: 15, averageLengthMinutes: 14 },
  ],
  averageLengthMinutes: 10,
  perDay: [
    { day: '2026-11-07', share: 7 },
    { day: '2026-11-08', share: 6 },
    { day: '2026-11-09', share: 6 },
    { day: '2026-11-10', share: 6 },
    { day: '2026-11-11', share: 4 },
  ],
};
const INSIGHTS: CommunityInsights = {
  status: 'ready',
  timeZone: 'UTC',
  sessionGapMinutes: 30,
  minimumMatches: 10,
  dimensions: [
    {
      id: 'weekday',
      title: 'Day of the week',
      buckets: [
        { label: 'Monday', status: 'ready', share: 19, winRate: 50 },
        { label: 'Tuesday', status: 'ready', share: 17, winRate: 49 },
      ],
    },
    {
      id: 'session',
      title: 'Place in a play session',
      buckets: [{ label: 'Match 1', status: 'ready', share: 14, winRate: 49 }],
    },
  ],
};

describe('StatsOverviewComponent', () => {
  let fixture: ComponentFixture<StatsOverviewComponent>;
  let http: HttpTestingController;
  let stage: HTMLElement;

  /** Puts the page in a column of `width` pixels, as the Stats page does, so the real layout runs. */
  async function open(width: number, answers: { counts?: unknown; matches?: unknown; insights?: unknown } = {}): Promise<HTMLElement> {
    stage = document.createElement('div');
    stage.style.width = `${width}px`;
    document.body.appendChild(stage);
    fixture = TestBed.createComponent(StatsOverviewComponent);
    stage.appendChild(fixture.nativeElement);
    fixture.detectChanges();

    http.expectOne('/api/game-stats').flush(answers.counts === undefined ? COUNTS : answers.counts);
    http.expectOne('/api/community/matches').flush(answers.matches === undefined ? MATCHES : answers.matches);
    http.expectOne('/api/community/insights').flush(answers.insights === undefined ? INSIGHTS : answers.insights);
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => {
    stage?.remove();
    http.verify();
  });

  for (const width of [360, 768, 1024, 1440]) {
    it(`stacks its sections without any one drawn over the next at ${width}px`, async () => {
      const element = await open(width);
      const sections = Array.from(element.children) as HTMLElement[];
      const boxes = sections.map((section) => section.getBoundingClientRect());

      expect(sections.length).toBeGreaterThanOrEqual(4);
      boxes.slice(1).forEach((box, index) => expect(box.top).toBeGreaterThanOrEqual(boxes[index].bottom - 1));
      // A section whose own height is shorter than its content spills over what follows.
      sections.forEach((section) => expect(section.scrollHeight).toBeLessThanOrEqual(section.clientHeight + 1));
      expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth + 1);
    });
  }

  it('keeps the panels of a row level and their tables in the same columns', async () => {
    const element = await open(1440);
    const panels = Array.from(element.querySelectorAll('app-community-matches-tab .stat-panel')) as HTMLElement[];
    const tops = new Set(panels.map((panel) => Math.round(panel.getBoundingClientRect().top)));
    const heights = new Set(panels.map((panel) => Math.round(panel.getBoundingClientRect().height)));

    expect(panels.length).toBe(3);
    expect(tops.size).toBe(1);
    expect(heights.size).toBe(1);
  });

  it('is a compact summary: the headline figures, the best and worst three maps, the modes, the days and when players win', async () => {
    const element = await open(1440);
    const headings = Array.from(element.querySelectorAll('h2, h3')).map((heading) => heading.textContent?.trim());

    expect(headings).toEqual([
      'By half-season',
      'Community matches',
      'Win rate by map',
      'Game modes played',
      'Matches per day',
      'When the community plays and wins',
      'Day of the week',
      'Place in a play session',
    ]);
    expect(element.querySelector('app-hub-tile')).toBeNull();
    expect(Array.from(element.querySelectorAll('.strip__tile dd')).map((value) => value.textContent?.trim())).toEqual([
      '799',
      '502',
      '8,349',
      'Sep 20, 2026',
    ]);
    expect(Array.from(element.querySelectorAll('app-community-matches-tab .stat-table tbody th[scope="row"]')).map((row) => row.textContent?.trim()))
      .toEqual(['Yggdrasill path', "Birnin t'challa", 'Hall of Djalia', 'Spider-islands', 'Midtown', 'Lower Manhattan', 'Quick Match', 'Competitive']);
  });

  it('keeps every map one link away: a single All N maps link to the Maps tab, not a second list', async () => {
    const element = await open(1440);
    const links = Array.from(element.querySelectorAll('app-community-matches-tab a.stat-link'));

    expect(element.querySelector('app-community-matches-tab .stat-fold')).toBeNull();
    expect(links.map((link) => link.textContent?.trim())).toEqual(['All 7 maps']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/stats/maps']);
  });

  it('names no map waiting for a rate: the Maps tab does that', async () => {
    const element = await open(1440, { matches: { ...MATCHES, mapsBelowMinimum: ['Klyntar'] } });

    expect(element.textContent).not.toContain('Klyntar');
  });

  it('opens only the first insights panel, so the page stays short', async () => {
    const element = await open(1440);
    const panels = Array.from(element.querySelectorAll('app-community-insights-tab details.stat-panel')) as HTMLDetailsElement[];

    expect(panels.map((panel) => panel.open)).toEqual([true, false]);
  });

  it('links the map teaser to the Maps tab and offers the pages about these numbers', async () => {
    const element = await open(1440);
    const hrefs = (selector: string): (string | null)[] =>
      Array.from(element.querySelectorAll(selector)).map((link) => link.getAttribute('href'));

    expect(hrefs('a.stat-link')).toEqual(['/stats/maps']);
    expect(hrefs('.pill-links a')).toEqual(['/how-we-count', '/privacy', '/profile']);
  });

  it('draws one heartbeat line behind the figures, beating at the pace of the recent uploads', async () => {
    await open(1440);

    const lines = fixture.debugElement.queryAll(By.directive(HeartbeatLineComponent));

    expect(lines.length).toBe(1);
    expect((lines[0].nativeElement as HTMLElement).getAttribute('aria-hidden')).toBe('true');
    expect((lines[0].componentInstance as HeartbeatLineComponent).rate()).toBe(heartbeatRate((502 * 6) / 100));
  });

  it('rests the heartbeat at its calm default until the recent pace is known', async () => {
    await open(1440, { matches: { ...MATCHES, status: 'not-enough-data', perDay: null, matchesCounted: null, maps: [] } });

    const line = fixture.debugElement.query(By.directive(HeartbeatLineComponent));

    expect((line.componentInstance as HeartbeatLineComponent).rate()).toBe(heartbeatRate(null));
  });

  it('still shows the other sections when one of them cannot be loaded', async () => {
    const element = await open(1440, { matches: null });

    expect(element.querySelector('.strip')).not.toBeNull();
    expect(element.textContent).toContain("The community's matches could not be loaded");
    expect(element.querySelector('app-community-insights-tab .stat-panel')).not.toBeNull();
  });
});
