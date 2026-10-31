import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { StatsSnapshotComponent } from './stats-snapshot.component';

const roster = [
  { id: 'hulk', name: 'Hulk', role: 'Vanguard', imageUrl: '/images/heroes/hulk.png' },
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' },
  { id: 'mantis', name: 'Mantis', role: 'Strategist', imageUrl: '/images/heroes/mantis.png' },
];

const populated = statsOf([
  { name: 'S', heroes: [statsHero('hulk', 30, 18, 20, 'S')] },
  { name: 'C', heroes: [statsHero('storm', 24, 12, 30)] },
]);

describe('StatsSnapshotComponent', () => {
  let fixture: ComponentFixture<StatsSnapshotComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    fixture = TestBed.createComponent(StatsSnapshotComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const tabs = (): HTMLButtonElement[] => Array.from(element.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const selectedTab = (): HTMLButtonElement => tabs().find((tab) => tab.getAttribute('aria-selected') === 'true')!;
  const rowNames = (): string[] =>
    Array.from(element.querySelectorAll('tbody tr')).map((row) => text(row.querySelector('th a')));

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function answer(stats: HeroStats | object | null, heroes: object[] = roster): Promise<void> {
    http.expectOne('/api/heroes').flush(heroes);
    if (stats === null) {
      http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      http.expectOne('/api/hero-stats').flush(stats);
    }
    await settle();
    expect(element.textContent).not.toMatch(/NaN|Infinity|undefined/);
  }

  async function press(key: string, init: KeyboardEventInit = {}): Promise<void> {
    selectedTab().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
    await settle();
  }

  describe('while the numbers load', () => {
    it('reserves the panel and marks it busy, with the heading already in place', () => {
      expect(text(element.querySelector('h2'))).toBe('Hero stats');
      expect(element.querySelector('[aria-busy="true"]')).toBeTruthy();
      expect(element.querySelector('[role="tablist"]')).toBeNull();
      http.expectOne('/api/heroes').flush(roster);
      http.expectOne('/api/hero-stats').flush(populated);
    });
  });

  describe('with numbers', () => {
    beforeEach(async () => answer(populated));

    it('puts the half-season of the stats in the heading', () => {
      expect(text(element.querySelector('h2'))).toBe('Hero stats · Season 10.5');
      expect(element.querySelector('section')?.getAttribute('aria-labelledby')).toBe(element.querySelector('h2')?.id);
    });

    it('draws a tablist of the four roles with only the selected tab in the tab order', () => {
      expect(element.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Hero stats by role');
      expect(tabs().map(text)).toEqual(['All', 'Vanguard', 'Duelist', 'Strategist']);
      expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
      expect(selectedTab()).toBe(tabs()[0]);
    });

    it('connects the panel to the selected tab', () => {
      const panel = element.querySelector('[role="tabpanel"]') as HTMLElement;

      expect(panel.getAttribute('aria-labelledby')).toBe(selectedTab().id);
      expect(panel.getAttribute('tabindex')).toBe('0');
      expect(tabs().every((tab) => tab.getAttribute('aria-controls') === panel.id)).toBeTrue();
    });

    it('lists the heroes by pick rate in a real table with figures, links and a tier badge', () => {
      expect(Array.from(element.querySelectorAll('thead th')).map(text)).toEqual([
        'Hero',
        'Tier',
        'Win rate',
        'Pick rate',
        'Appearances',
      ]);
      expect(rowNames()).toEqual(['Storm', 'Hulk']);

      const hulk = element.querySelectorAll('tbody tr')[1];

      expect(hulk.querySelector('th a')?.getAttribute('href')).toBe('/heroes?hero=hulk');
      expect(text(hulk.querySelector('.tier'))).toBe('Tier S');
      expect(text(hulk)).toContain('60.0%');
      expect(text(hulk)).toContain('20.0%');
      expect(text(hulk)).toContain('30');
    });

    it('does not rely on colour for the win rate cue', () => {
      const hulk = element.querySelectorAll('tbody tr')[1];

      expect(text(hulk.querySelector('.cue'))).toBe('▲');
      expect(text(hulk)).toContain('above 50%');
    });

    it('switches panels in place when a tab is clicked', async () => {
      tabs()[2].click();
      await settle();

      expect(selectedTab()).toBe(tabs()[2]);
      expect(rowNames()).toEqual(['Storm']);
      expect(tabs().map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
      expect(element.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(tabs()[2].id);
    });

    it('moves and selects with the arrow keys, wrapping at the ends', async () => {
      await press('ArrowRight');
      expect(selectedTab()).toBe(tabs()[1]);
      expect(document.activeElement).toBe(tabs()[1]);

      await press('ArrowLeft');
      await press('ArrowLeft');
      expect(selectedTab()).toBe(tabs()[3]);
    });

    it('jumps to the first and last tab with Home and End', async () => {
      await press('End');
      expect(selectedTab()).toBe(tabs()[3]);

      await press('Home');
      expect(selectedTab()).toBe(tabs()[0]);
    });

    it('leaves the key alone when a modifier is held', async () => {
      await press('ArrowRight', { altKey: true });

      expect(selectedTab()).toBe(tabs()[0]);
    });

    it('explains a role with no qualifying hero, keeps the tab enabled and links to the community stats', async () => {
      tabs()[3].click();
      await settle();

      expect(tabs()[3].disabled).toBeFalse();
      expect(element.querySelector('table')).toBeNull();
      expect(text(element.querySelector('.empty__message'))).toBe('Not enough Strategist data yet. A hero appears after 10 appearances.');
      expect(element.querySelector('.empty__link')?.getAttribute('href')).toBe('/community');
    });

    it('says the sample behind the numbers under the table', () => {
      expect(text(element.querySelector('.snapshot__sample'))).toBe(
        'From 149 matches by Rivals Pulse players. Only heroes with at least 10 appearances are listed.',
      );
    });

    it('links to the community stats and the tier list in the footer', () => {
      const links = Array.from(element.querySelectorAll('.snapshot__links a'));

      expect(links.map((link) => [text(link), link.getAttribute('href')])).toEqual([
        ['See all hero stats', '/community'],
        ['See full tier list', '/tier-list'],
      ]);
    });

    it('invites visitors to add to the data, as plain text while there is no store listing', () => {
      const invitation = element.querySelector('.snapshot__invitation');

      expect(text(invitation)).toBe('Every match played with Rivals Pulse makes these stats sharper.');
      expect(invitation?.querySelector('a')).toBeNull();
    });
  });

  describe('with no hero at the minimum yet', () => {
    beforeEach(async () => answer(statsOf([], { matchesCounted: 3 })));

    it('shows a designed empty state, with the minimum, the link and the invitation, and no zeros', () => {
      expect(element.querySelector('table')).toBeNull();
      expect(text(element.querySelector('.empty__message'))).toContain('Stats appear once enough matches are uploaded');
      expect(text(element.querySelector('.empty__message'))).toContain('10 appearances');
      expect(element.querySelector('.empty__link')?.getAttribute('href')).toBe('/community');
      expect(text(element.querySelector('.snapshot__invitation'))).toContain('sharper');
      expect(text(element.querySelector('[role="tabpanel"]'))).not.toMatch(/(^|\s)0(\.0)?%?(\s|$)/);
    });
  });

  describe('when the previous half-season stands in', () => {
    it('says so above the tabs', async () => {
      await answer({ ...populated, halfSeason: { ...populated.halfSeason!, id: 10, label: 'Season 10' }, inPlaceOf: populated.halfSeason });

      expect(text(element.querySelector('h2'))).toBe('Hero stats · Season 10');
      expect(text(element.querySelector('.snapshot__notice'))).toContain('Season 10.5 does not have enough data yet');
    });
  });

  describe('when the numbers cannot be read', () => {
    beforeEach(async () => answer(null));

    it('shows one line and a retry button instead of a blank panel', () => {
      expect(text(element.querySelector('.snapshot__message p'))).toContain('cannot be loaded');
      expect(element.querySelector('[role="tablist"]')).toBeNull();
      expect(text(element.querySelector('.snapshot__retry'))).toBe('Try again');
    });

    it('asks again when retried and shows the answer', async () => {
      (element.querySelector('.snapshot__retry') as HTMLButtonElement).click();
      await settle();

      expect(element.querySelector('[aria-busy="true"]')).toBeTruthy();

      http.expectOne('/api/hero-stats').flush(populated);
      await settle();

      expect(rowNames()).toEqual(['Storm', 'Hulk']);
    });
  });

  describe('when the hero list cannot be read', () => {
    it('still lists the heroes on the All tab and explains the role tabs', async () => {
      http.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });
      http.expectOne('/api/hero-stats').flush(populated);
      await settle();

      expect(rowNames()).toEqual(['Storm', 'Hulk']);

      tabs()[2].click();
      await settle();

      expect(text(element.querySelector('.empty__message'))).toContain('hero list could not be loaded');
    });
  });
});
