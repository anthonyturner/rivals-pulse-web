import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { HeroOverlayActionsComponent } from './hero-overlay-actions.component';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const stats: CommunityMatches = {
  status: 'ready',
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 1482,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthMinutes: null,
  perDay: null,
};

describe('HeroOverlayActionsComponent', () => {
  let fixture: ComponentFixture<HeroOverlayActionsComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    fixture = TestBed.createComponent(HeroOverlayActionsComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const statBlocks = (): HTMLElement[] => Array.from(element.querySelectorAll('.stat'));
  const pair = (stat: Element): string => `${text(stat.querySelector('dt'))}: ${text(stat.querySelector('dd'))}`;

  async function answer(body: object): Promise<void> {
    http.expectOne('/api/community/matches').flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('leads with the shared get-app button, ahead of "See hero stats"', () => {
    const button = element.querySelector('app-get-app-button') as HTMLElement;

    expect(text(button)).not.toMatch(/coming soon/i);
    expect(button.nextElementSibling).toBe(element.querySelector('a.cta-ghost'));
  });

  it('sends "See hero stats" to the hero stats page', () => {
    const link = element.querySelector('a.cta-ghost') as HTMLAnchorElement;

    expect(text(link)).toBe('See hero stats');
    expect(link.getAttribute('href')).toBe('/win-rates');
  });

  it('shows downloads and rating as "Coming soon" and reserves the matches slot while loading', () => {
    expect(statBlocks().map(pair)).toEqual([
      'Downloads: Coming soon',
      'Rating on Overwolf: Coming soon',
      'Matches counted: ',
    ]);
    expect(element.querySelector('.stat.is-loading .skeleton')).not.toBeNull();
    expect(element.querySelector('a.how-we-count')?.getAttribute('href')).toBe('/how-we-count');
  });

  it('states the matches counted once the stats arrive', async () => {
    await answer(stats);

    expect(pair(statBlocks()[2])).toBe('Matches counted · Season 10.5: 1,482');
    expect(element.querySelector('.stat.is-loading')).toBeNull();
    expect(element.querySelector('a.how-we-count')?.getAttribute('href')).toBe('/how-we-count');
  });

  it('drops the matches figure, and prints no zero, when the stats cannot be read', async () => {
    await answer({ unexpected: true });

    expect(statBlocks().length).toBe(2);
    expect(element.textContent).not.toMatch(/NaN|\b0\b/);
  });
});
