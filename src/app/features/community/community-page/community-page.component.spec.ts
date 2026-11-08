import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { communityRoutes } from '../community.routes';

const TAB_LABELS = ['Heroes', 'Matches', 'Counters', 'Tier list', 'Stats', 'Insights'];

// What /api/community/matches answers while no half-season has enough matches yet.
const MATCHES_NOT_ENOUGH_DATA = {
  status: 'not-enough-data',
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesBand: null,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthMinutes: null,
  perDay: null,
};

describe('CommunityPageComponent', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  const host = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const tabs = (): HTMLElement[] => Array.from(host().querySelectorAll<HTMLElement>('[role="tab"]'));
  const selectedTab = (): HTMLElement | undefined =>
    tabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
  const panel = (): HTMLElement => host().querySelector('[role="tabpanel"]') as HTMLElement;

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
  }

  /** The Insights tab reads its numbers from the site's API; the API's own answer for "nothing yet". */
  async function answerInsightsWithNoData(): Promise<void> {
    TestBed.inject(HttpTestingController)
      .expectOne('/api/community/insights')
      .flush({
        status: 'not-enough-data',
        timeZone: 'UTC',
        sessionGapMinutes: null,
        minimumMatches: 10,
        dimensions: [],
      });
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function answerMatchesTab(): Promise<void> {
    // The lead tile's totals ask for the same answer, so every request for it is answered.
    TestBed.inject(HttpTestingController)
      .match('/api/community/matches')
      .forEach((request) => request.flush(MATCHES_NOT_ENOUGH_DATA));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function pressOnSelectedTab(key: string, modifiers: KeyboardEventInit = {}): Promise<void> {
    selectedTab()?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }),
    );
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(communityRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  it('opens on the Heroes tab at the bare /community URL', async () => {
    await open('/');

    expect(router.url).toBe('/heroes');
    expect(selectedTab()?.textContent?.trim()).toBe('Heroes');
  });

  it('shows the six tabs in the order of the desktop app', async () => {
    await open('/matches');

    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(TAB_LABELS);
  });

  it('selects the tab named in the URL and announces it', async () => {
    await open('/stats');

    expect(selectedTab()?.textContent?.trim()).toBe('Stats');
    expect(tabs().filter((tab) => tab.getAttribute('aria-selected') === 'true').length).toBe(1);
    expect(panel().getAttribute('aria-labelledby')).toBe(selectedTab()?.id ?? null);
    expect(selectedTab()?.getAttribute('aria-controls')).toBe(panel().id);
  });

  it('keeps only the selected tab in the tab order', async () => {
    await open('/insights');

    const focusable = tabs().filter((tab) => tab.getAttribute('tabindex') === '0');
    expect(focusable).toEqual([selectedTab() as HTMLElement]);
  });

  it('falls back to the Heroes tab for an unknown tab in the URL', async () => {
    await open('/not-a-tab');

    expect(router.url).toBe('/heroes');
  });

  it('switches tab when a tab is clicked', async () => {
    await open('/heroes');

    const matches = tabs()[1];
    matches.addEventListener('click', (event: Event) => event.preventDefault());
    matches.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/matches');
    expect(selectedTab()?.textContent?.trim()).toBe('Matches');
    await answerMatchesTab();
    expect(panel().textContent).toContain('Community matches');
  });

  it('moves to the next and previous tab with the arrow keys, wrapping at the ends', async () => {
    await open('/heroes');

    await pressOnSelectedTab('ArrowRight');
    expect(router.url).toBe('/matches');

    await pressOnSelectedTab('ArrowLeft');
    expect(router.url).toBe('/heroes');

    await pressOnSelectedTab('ArrowLeft');
    expect(router.url).toBe('/insights');

    await pressOnSelectedTab('ArrowRight');
    expect(router.url).toBe('/heroes');
  });

  it('jumps to the first and last tab with Home and End', async () => {
    await open('/counters');

    await pressOnSelectedTab('End');
    expect(router.url).toBe('/insights');

    await pressOnSelectedTab('Home');
    expect(router.url).toBe('/heroes');
  });

  it('moves focus to the tab the arrow key selected', async () => {
    await open('/heroes');
    tabs()[0].focus();

    await pressOnSelectedTab('ArrowRight');

    expect(document.activeElement).toBe(tabs()[1]);
  });

  it('leaves browser shortcuts such as Alt+Left alone', async () => {
    await open('/matches');

    await pressOnSelectedTab('ArrowLeft', { altKey: true });
    await pressOnSelectedTab('ArrowRight', { ctrlKey: true });
    await pressOnSelectedTab('ArrowRight', { metaKey: true });

    expect(router.url).toBe('/matches');
  });

  it('ignores other keys', async () => {
    await open('/heroes');

    await pressOnSelectedTab('a');

    expect(router.url).toBe('/heroes');
  });

  // The Heroes, Counters, Tier list and Stats tabs load their numbers; their own specs cover their empty states.
  for (const [id, label] of [
    ['matches', 'Matches'],
    ['insights', 'Insights'],
  ]) {
    it(`shows the designed empty state on the ${label} tab`, async () => {
      await open(`/${id}`);
      if (id === 'insights') {
        await answerInsightsWithNoData();
      }
      if (id === 'matches') {
        await answerMatchesTab();
      }

      const text = panel().textContent ?? '';
      expect(text).toMatch(/enough data yet|enough matches/);
      expect(text).toContain('Totals appear once enough matches have been uploaded');
      expect(text).not.toMatch(/NaN|undefined|null/);
      expect(text).not.toMatch(/(^|\s)0(\s|$)/);
      expect(panel().querySelector('app-state-panel')).toBeTruthy();
      expect(panel().querySelectorAll('h2').length).toBe(1);
      expect(panel().querySelector('h3')).toBeNull();
    });
  }

  for (const id of ['matches', 'insights']) {
    it(`links the ${id} tab to My stats, where the account's own figures are`, async () => {
      await open(`/${id}`);
      if (id === 'insights') {
        await answerInsightsWithNoData();
      } else {
        await answerMatchesTab();
      }

      const links = Array.from(panel().querySelectorAll('a'));

      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/profile']);
    });

    it(`needs no sign-in and never reads an account's dashboard on the ${id} tab`, async () => {
      const fetchSpy = spyOn(window, 'fetch').and.rejectWith(new Error('no request expected'));

      await open(`/${id}`);
      if (id === 'insights') {
        await answerInsightsWithNoData();
      } else {
        await answerMatchesTab();
      }

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(panel().textContent).not.toMatch(/sign in/i);
    });
  }

  const tileLinks = (): HTMLAnchorElement[] =>
    Array.from(host().querySelectorAll<HTMLAnchorElement>('app-hub-bento a'));

  it('points to My stats, the privacy notes and How we count from tiles, not from the intro', async () => {
    await open('/heroes');

    expect(tileLinks().map((link) => [link.textContent?.trim(), link.getAttribute('href')])).toEqual([
      ['How we count', '/how-we-count'],
      ['Privacy notes', '/privacy'],
      ['My stats', '/profile'],
    ]);
    expect(host().querySelector('app-page-header')?.querySelector('a')).toBeNull();
    expect(host().textContent).not.toMatch(/My matches|My insights|exceptions/);
  });

  it('says the numbers are anonymous totals, under a one-line title', async () => {
    await open('/heroes');

    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Community totals');
    expect(host().querySelector('app-page-header .description')?.textContent).toContain('Anonymous totals');
  });

  it('keeps the page header plain and leads with a key-art tile that is decoration', async () => {
    await open('/heroes');

    const lead = host().querySelector<HTMLElement>('app-hub-tile.featured');
    const art = lead?.querySelector<HTMLElement>('.art');

    expect(host().querySelector('app-page-header')?.querySelector('img')).toBeNull();
    expect(art?.getAttribute('aria-hidden')).toBe('true');
    expect(art?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(lead?.querySelector('h2')?.textContent?.trim()).toBe('How we count');
  });

  it('shows the real totals in the lead tile, and nothing while there are none', async () => {
    await open('/heroes');

    const http = TestBed.inject(HttpTestingController);
    const requests = http.match('/api/community/matches');
    expect(host().querySelector('app-community-totals-preview .figure')).toBeNull();

    requests.forEach((request) => request.flush({ ...MATCHES_NOT_ENOUGH_DATA, status: 'ready', matchesBand: 250, halfSeason: { id: 10, label: 'Season 10', startsAt: null, endsAt: null }, averageLengthMinutes: 12 }));
    await harness.fixture.whenStable();
    harness.detectChanges();

    const figures = Array.from(host().querySelectorAll('app-community-totals-preview .figure')).map((figure) => [
      figure.querySelector('dt')?.textContent,
      figure.querySelector('dd')?.textContent,
    ]);
    expect(figures).toEqual([
      ['Matches counted', '250+'],
      ['Average match', '12 min'],
      ['Season', 'Season 10'],
    ]);
  });

  describe('on a narrow screen', () => {
    beforeEach(() => {
      (harness.fixture.nativeElement as HTMLElement).style.width = '384px';
    });

    it('scrolls the tab bar so the selected tab is fully in view on a direct visit', async () => {
      await open('/insights');
      await harness.fixture.whenStable();

      const bar = host().querySelector('[role="tablist"]') as HTMLElement;
      const tab = selectedTab()?.getBoundingClientRect() as DOMRect;
      const range = bar.getBoundingClientRect();

      expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
      expect(bar.scrollLeft).toBeGreaterThan(0);
      expect(tab.left).toBeGreaterThanOrEqual(range.left - 1);
      expect(tab.right).toBeLessThanOrEqual(range.right + 1);
    });

    it('leaves the bar where it is when the selected tab is already in view', async () => {
      const scrollTo = spyOn(HTMLElement.prototype, 'scrollTo').and.callThrough();

      await open('/heroes');
      await harness.fixture.whenStable();

      expect(scrollTo).not.toHaveBeenCalled();
      expect((host().querySelector('[role="tablist"]') as HTMLElement).scrollLeft).toBe(0);
    });
  });
});
