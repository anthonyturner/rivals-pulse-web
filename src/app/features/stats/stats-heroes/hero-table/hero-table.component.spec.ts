import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats, HeroStatsHero } from '../../../../../contracts/hero-stats.model';
import { heroIdentities } from '../../../insights/hero-identity';
import { HeroTableComponent } from './hero-table.component';
import { buildWinRatesView } from './win-rates-view';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };

function hero(slug: string, appearances: number, wins: number, pickRate = 10): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate,
    shrunkWinRate: 50,
    tier: 'B',
    kda: null,
    finalHitsAverage: null,
  };
}

const empty: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};
const partial: HeroStats = {
  ...empty,
  halfSeason: season,
  matchesCounted: 3,
  belowMinimum: [
    { hero: 'storm', appearances: 4 },
    { hero: 'thor', appearances: 2 },
  ],
};
const full: HeroStats = {
  ...partial,
  status: 'ready',
  matchesCounted: 149,
  tiers: [{ name: 'A', heroes: [hero('storm', 12, 8), hero('hela', 20, 9)] }],
};

const ROSTER = [
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: null },
  { id: 'hela', name: 'Hela', role: 'Vanguard', imageUrl: null },
  { id: 'thor', name: 'Thor', role: 'Vanguard', imageUrl: null },
];

describe('HeroTableComponent', () => {
  let fixture: ComponentFixture<HeroTableComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
  });

  function show(stats: HeroStats): void {
    fixture = TestBed.createComponent(HeroTableComponent);
    fixture.componentRef.setInput('view', buildWinRatesView(stats, heroIdentities(ROSTER)));
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  const text = (selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.trim() ?? '');
  const squash = (value: string): string => value.replace(/\s+/g, ' ');

  function choose(select: HTMLSelectElement, value: string): void {
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('keeps summary leaders within the selected role and search', () => {
    show(full);
    const role = element.querySelector<HTMLSelectElement>('.filters app-filter-select select');

    if (role === null) {
      throw new Error('Role filter is missing');
    }

    choose(role, 'Vanguard');

    expect(text('tbody .hero-name')).toEqual(['Hela']);
    expect(text('.summary button').every((label) => label.includes('Hela'))).toBeTrue();
    expect(element.querySelectorAll('.col-ban button').length).toBe(0);
  });

  it('lists each hero with its win rate and record once there is enough data', () => {
    show(full);

    expect(text('tbody .hero-name')).toEqual(['Storm', 'Hela']);
    expect(text('tbody .rate strong')).toEqual(['66.7%', '45.0%']);
    expect(text('tbody .col-games [aria-hidden="true"]:not(.mobile-label)')).toEqual(['8 / 12', '9 / 20']);
    expect(text('tbody .col-games .visually-hidden')).toEqual(['8 wins in 12 games', '9 wins in 20 games']);
    expect(text('h3')[0]).toBe('Heroes · Win rate, highest first');
  });

  it('draws a real table: every header names its scope and the heading names the table', () => {
    show(full);
    const table = element.querySelector('table') as HTMLTableElement;
    const headers = Array.from(table.querySelectorAll('th'));

    expect(table.getAttribute('aria-labelledby')).toBe('rates-title');
    expect(element.querySelector('#rates-title')?.tagName).toBe('H3');
    expect(headers.every((header) => header.getAttribute('scope') !== null)).toBeTrue();
    expect(Array.from(table.querySelectorAll('thead th')).map((header) => header.textContent?.trim())).toEqual([
      '#Rank',
      'Hero',
      'Role',
      'Win rate ↓',
      'Pick rate ↕',
      'Ban rate',
      'Wins / games',
    ]);
  });

  it('links each hero to the heroes page and keeps the decorative portrait out of the reading order', () => {
    show(full);
    const link = element.querySelector('tbody a') as HTMLAnchorElement;
    const image = link.querySelector('img') as HTMLImageElement;

    expect(link.getAttribute('href')).toBe('/heroes/storm');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('width')).toBe('28');
  });

  it('sorts picks from the summary and the table, announces the order, and filters without another request', () => {
    show({
      ...full,
      tiers: [{ name: 'A', heroes: [hero('storm', 12, 8, 120), hero('hela', 20, 9, 150)] }],
    });

    expect(text('.summary button')[1]).toContain('Hela');
    element.querySelectorAll<HTMLButtonElement>('.summary button')[1].click();
    fixture.detectChanges();
    expect(text('tbody .hero-name')).toEqual(['Hela', 'Storm']);
    expect(element.querySelector('[aria-sort="descending"]')?.textContent).toContain('Pick rate');
    expect(element.querySelector('[aria-live]')?.textContent).toContain('pick rate, highest first');

    element.querySelector<HTMLButtonElement>('.col-pick button')?.click();
    fixture.detectChanges();
    expect(text('tbody .hero-name')).toEqual(['Storm', 'Hela']);

    const search = element.querySelector<HTMLInputElement>('input[type="search"]');

    if (search === null) {
      throw new Error('Search input is missing');
    }

    search.value = ' no such hero ';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(element.textContent).toContain('No heroes match these filters');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.summary')?.textContent).not.toContain('Hela');

    element.querySelector<HTMLButtonElement>('.reset-filters')?.click();
    fixture.detectChanges();
    expect(text('tbody .hero-name').length).toBe(2);
    expect(element.textContent).toContain('Not collected');
  });

  it('has the filter bar only while there are heroes to filter', () => {
    show(full);
    expect(element.querySelector('.filters')).not.toBeNull();

    show(empty);
    expect(element.querySelector('.filters')).toBeNull();
  });

  it('shows heroes still short of the minimum as not enough data yet, beside the full table', () => {
    show(full);

    expect(text('.building h3')).toEqual(['Progress toward a win rate']);
    expect(text('.building-name')).toEqual(['Storm', 'Thor']);
    expect(text('.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('filters the heroes still building by the search and the role', () => {
    show(full);
    const role = element.querySelector<HTMLSelectElement>('.filters app-filter-select select') as HTMLSelectElement;

    choose(role, 'Vanguard');

    expect(text('.building-name')).toEqual(['Thor']);
  });

  it('shows the matches counted and no table while no hero has enough data', () => {
    show(partial);

    expect(text('app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive for Season 10.5']);
    expect(squash(text('app-state-panel p')[0])).toContain(
      '3 matches with a result in Quick Match and Competitive for Season 10.5 so far',
    );
    expect(element.querySelector('table')).toBeNull();
    expect(text('.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('draws a designed empty state, not blank panels, when nothing is counted', () => {
    show(empty);

    expect(text('app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive']);
    expect(squash(text('app-state-panel p')[0])).toContain('No matches with a result in Quick Match and Competitive yet');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.building')).toBeNull();
  });

  it('says what the ban column is missing, and that the missing data is not a 0% ban rate', () => {
    show(full);

    expect(element.querySelector('table')?.getAttribute('aria-describedby')).toBe('ban-note');
    expect(element.querySelector('#ban-note')?.textContent).toContain('Missing ban data does not mean a 0% ban rate');
  });

  it('keeps one live region and leaves it empty until a filter changes', () => {
    show(full);

    expect(element.querySelectorAll('[aria-live]').length).toBe(1);
    expect(element.querySelector('[aria-live]')?.textContent?.trim()).toBe('');
  });
});
