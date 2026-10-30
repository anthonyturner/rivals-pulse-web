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
  minimums: { overviewMatches: 20, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthSeconds: null,
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

  async function answerMatchesTab(): Promise<void> {
    TestBed.inject(HttpTestingController).expectOne('/api/community/matches').flush(MATCHES_NOT_ENOUGH_DATA);
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

  for (const [id, label] of [
    ['heroes', 'Heroes'],
    ['matches', 'Matches'],
    ['counters', 'Counters'],
    ['tier-list', 'Tier list'],
    ['stats', 'Stats'],
    ['insights', 'Insights'],
  ]) {
    it(`shows the designed empty state on the ${label} tab`, async () => {
      await open(`/${id}`);
      if (id === 'matches') {
        await answerMatchesTab();
      }

      const text = panel().textContent ?? '';
      expect(text).toContain('Not enough data yet');
      expect(text).toContain('Rivals Pulse app uploads');
      expect(text).not.toMatch(/NaN|undefined|null/);
      expect(text).not.toMatch(/(^|\s)0(\s|$)/);
      expect(panel().querySelector('.empty-state')).toBeTruthy();
      expect(panel().querySelector('h2')).toBeTruthy();
      expect(panel().querySelector('h3')).toBeNull();
    });
  }

  for (const [id, href] of [
    ['heroes', '/heroes'],
    ['tier-list', '/tier-list'],
    ['counters', '/counters'],
  ]) {
    it(`links the ${id} tab to the existing ${href} page`, async () => {
      await open(`/${id}`);

      const link = panel().querySelector<HTMLAnchorElement>('a[href]');
      expect(link?.getAttribute('href')).toBe(href);
    });
  }

  for (const id of ['matches', 'stats', 'insights']) {
    it(`has no link out of the ${id} tab, because no page exists for it`, async () => {
      await open(`/${id}`);

      expect(panel().querySelector('a')).toBeNull();
    });
  }

  it('links the anonymity note to the privacy notes', async () => {
    await open('/heroes');

    const link = host().querySelector<HTMLAnchorElement>('.community-page__note a');
    expect(link?.getAttribute('href')).toBe('/privacy');
  });

  it('says the numbers are anonymous community totals', async () => {
    await open('/heroes');

    expect(host().textContent).toContain('anonymous community totals');
  });
});
