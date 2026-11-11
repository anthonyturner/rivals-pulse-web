import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero } from '../../../../../contracts/hero-stats.model';
import { heroIdentities } from '../../../insights/hero-identity';
import { HeroTiersComponent } from './hero-tiers.component';
import { buildTierListView } from './tier-list-view';

const current: HeroStatsHalfSeason = {
  id: 10.5,
  label: 'Season 10.5',
  startsAt: '2026-10-09T09:00:00Z',
  endsAt: null,
};

function hero(slug: string, appearances: number, wins: number, tier: HeroStatsHero['tier']): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 10,
    shrunkWinRate: 50,
    tier,
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
const building: HeroStats = {
  ...empty,
  halfSeasons: [current],
  halfSeason: current,
  matchesCounted: 3,
  belowMinimum: [
    { hero: 'storm', appearances: 4 },
    { hero: 'thor', appearances: 2 },
  ],
};
const placed: HeroStats = {
  ...building,
  status: 'ready',
  matchesCounted: 146,
  tiers: [{ name: 'A', heroes: [hero('storm', 12, 8, 'A'), hero('hela', 20, 14, 'A')] }],
  belowMinimum: [{ hero: 'thor', appearances: 2 }],
};

describe('HeroTiersComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
  });

  function show(stats: HeroStats): void {
    const fixture = TestBed.createComponent(HeroTiersComponent);

    fixture.componentRef.setInput('view', buildTierListView(stats, heroIdentities([])));
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');
  }

  const text = (selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.trim().replace(/\s+/g, ' ') ?? '');

  it('draws art-led hero tiles that link to their hero', () => {
    show(placed);
    const tile = element.querySelector('app-tier-rows app-hero-tile');

    expect(tile?.classList).toContain('art-led');
    expect(tile?.querySelector('a')?.getAttribute('href')).toMatch(/^\/heroes\//);
  });

  it('draws a row for each tier that has a hero, with the placed heroes and their sample', () => {
    show(placed);

    expect(text('.tier-letter')).toEqual(['A']);
    expect(text('.hero-name')).toEqual(['Storm', 'Hela']);
    expect(text('.hero-rate')).toEqual([', win rate 66.7%', ', win rate 70.0%']);
    expect(text('.hero-caption')).toEqual([
      ', pick rate 10.0% pick · , 12 games',
      ', pick rate 10.0% pick · , 20 games',
    ]);
  });

  it('lists the tiers and heroes as lists, and announces each tier with its letter and count', () => {
    show(placed);

    expect(element.querySelectorAll('ol.tiers > li').length).toBe(1);
    expect(element.querySelectorAll('ul.hero-grid > li').length).toBe(2);
    expect(text('.tier-label')).toEqual(['Tier A, 2 heroes']);
    expect(element.querySelector('dl, abbr, table')).toBeNull();
  });

  it('heads each tier one level under the section heading, so the heading order does not skip', () => {
    show(placed);

    expect(element.querySelector('.tier-label')?.tagName).toBe('H3');
    expect(element.querySelector('.building h3')?.textContent).toContain('Progress toward a tier');
  });

  it('says "1 hero" for a tier of one', () => {
    show({ ...placed, tiers: [{ name: 'S', heroes: [hero('storm', 12, 8, 'S')] }] });

    expect(text('.tier-label')[0]).toBe('Tier S, 1 hero');
  });

  it('shows a partial dataset as placed heroes plus the rest as not enough data yet, in the same structure', () => {
    show(placed);

    expect(text('.building h3')).toEqual(['Progress toward a tier']);
    expect(text('.building-name')).toEqual(['Thor']);
    expect(text('.building-count')).toEqual(['2 of 10']);
    expect(text('.building .section-heading p')).toEqual(['Heroes need 10 appearances before they are placed in a tier.']);
    expect(element.querySelectorAll('.tier-row').length).toBe(1);
  });

  it('draws no tier rows while no hero has enough data, and says how many matches are counted', () => {
    show(building);

    expect(text('app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive for Season 10.5']);
    expect(text('.state-count')[0]).toBe('3 matches with a result in Quick Match and Competitive for Season 10.5 so far.');
    expect(text('app-state-panel p')[1]).toContain('built from matches that RivalsPulse players record');
    expect(element.querySelector('.tier-row')).toBeNull();
    expect(text('.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('draws a designed empty state when nothing is counted', () => {
    show(empty);

    expect(text('app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive']);
    expect(text('.state-count')[0]).toBe('No matches with a result in Quick Match and Competitive so far.');
    expect(element.querySelector('.tier-row')).toBeNull();
    expect(element.querySelector('.building')).toBeNull();
  });
});
