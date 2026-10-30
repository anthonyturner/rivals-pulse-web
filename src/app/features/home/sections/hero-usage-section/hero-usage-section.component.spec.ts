import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats, HeroStatsHero } from '../../../../../contracts/hero-stats.model';
import { HeroUsageSectionComponent } from './hero-usage-section.component';
import { buildHeroUsageView } from './hero-usage-view';

function hero(slug: string, pickRate: number): HeroStatsHero {
  return {
    hero: slug,
    appearances: 20,
    wins: 10,
    winRate: 50,
    pickRate,
    shrunkWinRate: 50,
    tier: 'C',
    kda: null,
    finalHitsAverage: null,
  };
}

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const empty: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 3,
  tiers: [],
  belowMinimum: [],
};

describe('HeroUsageSectionComponent', () => {
  function render(stats: HeroStats | null): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });

    const fixture = TestBed.createComponent(HeroUsageSectionComponent);

    fixture.componentRef.setInput('eyebrow', 'Season 10 meta');
    fixture.componentRef.setInput('title', 'Most-used heroes');
    fixture.componentRef.setInput('view', buildHeroUsageView(stats, new Map()));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent?.toLowerCase()).not.toContain('rivals meta');

    return element;
  }

  const text = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.trim().replace(/\s+/g, ' ') ?? '');

  it('labels the numbers as based on Rivals Pulse players, with the sample size, and links the tier list', () => {
    const element = render({ ...empty, status: 'ready', tiers: [{ name: 'C', heroes: [hero('storm', 30)] }] });

    expect(text(element, '.section-meta span')).toEqual(['Based on Rivals Pulse players · 3 matches · Season 10.5']);
    expect(element.querySelector('.section-meta a')?.getAttribute('href')).toBe('/tier-list');
    expect(element.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('draws the qualifying heroes and marks the remaining slots as not enough data yet', () => {
    const element = render({ ...empty, status: 'ready', tiers: [{ name: 'C', heroes: [hero('storm', 30)] }] });

    expect(text(element, '.usage-card:not(.usage-card--empty) h3')).toEqual(['Storm']);
    expect(text(element, '.usage-card--empty')).toEqual(Array(4).fill('Not enough data yet'));
    expect(element.querySelectorAll('.usage-card').length).toBe(5);
  });

  it('shows one compact notice, not cards or zeros, while no hero has enough data', () => {
    const element = render(empty);

    expect(element.querySelector('.usage-card')).toBeNull();
    expect(text(element, '.usage-empty')[0]).toContain('Not enough data yet');
    expect(text(element, '.usage-empty')[0]).toContain('10 appearances');
    expect(text(element, '.section-meta span')[0]).toContain('3 matches');
  });

  it('shows a notice when the numbers could not be loaded', () => {
    const element = render(null);

    expect(text(element, '.usage-empty')[0]).toContain('cannot be loaded');
  });

  it('labels the previous half-season when it stands in for the current one', () => {
    const previous = { ...season, id: 10, label: 'Season 10' };
    const element = render({
      ...empty,
      status: 'ready',
      halfSeason: previous,
      inPlaceOf: season,
      tiers: [{ name: 'C', heroes: [hero('storm', 30)] }],
    });

    expect(text(element, '.usage-notice')[0]).toContain("Season 10's numbers");
  });
});
