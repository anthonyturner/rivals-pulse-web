import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { OVERWOLF_APP_URL } from '../../../shared/overwolf-app';
import { HeroOverlayActionsComponent } from './hero-overlay-actions.component';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const stats: HeroStats = {
  status: 'ready',
  minimumMatches: 10,
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 1482,
  tiers: [],
  belowMinimum: [],
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

  const trustLine = (): HTMLElement => element.querySelector('.trust-line') as HTMLElement;
  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function answer(body: object): Promise<void> {
    http.expectOne('/api/hero-stats').flush(body);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('the Overwolf button', () => {
    it('ships as an unavailable but focusable button while there is no store URL', () => {
      const button = element.querySelector('button.cta-primary') as HTMLButtonElement;

      expect(OVERWOLF_APP_URL).toBe('');
      expect(button).toBeTruthy();
      expect(button.type).toBe('button');
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.disabled).toBeFalse();
      expect(text(button)).toContain('Get Rivals Pulse on Overwolf');
      expect(text(button.querySelector('.pill'))).toBe('Coming soon');
      expect(text(button.querySelector('.visually-hidden'))).toContain('not available yet');
      expect(element.querySelector('a.cta-primary')).toBeNull();
    });

    it('becomes a link in the same slot once the store URL is set', () => {
      fixture.componentRef.setInput('appUrl', 'https://www.overwolf.com/app/rivals-pulse');
      fixture.detectChanges();

      const link = element.querySelector('a.cta-primary') as HTMLAnchorElement;

      expect(link.getAttribute('href')).toBe('https://www.overwolf.com/app/rivals-pulse');
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener noreferrer');
      expect(text(link)).toBe('Get Rivals Pulse on Overwolf');
      expect(element.querySelector('button.cta-primary')).toBeNull();
      expect(element.querySelector('.pill')).toBeNull();
    });
  });

  it('sends "See stats" to /community', () => {
    const link = element.querySelector('a.cta-ghost') as HTMLAnchorElement;

    expect(text(link)).toBe('See stats');
    expect(link.getAttribute('href')).toBe('/community');
  });

  describe('the trust line', () => {
    it('reserves its row and shows a skeleton while the stats load', () => {
      expect(trustLine().classList).toContain('is-loading');
      expect(trustLine().getAttribute('aria-busy')).toBe('true');
      expect(trustLine().querySelector('.skeleton')).not.toBeNull();
      expect(text(trustLine())).toBe('');
    });

    it('states the matches counted and their half-season', async () => {
      await answer(stats);

      expect(text(trustLine())).toBe('1,482 matches counted · Season 10.5');
      expect(trustLine().classList).not.toContain('is-loading');
      expect(trustLine().getAttribute('aria-busy')).toBe('false');
      expect(trustLine().querySelector('.skeleton')).toBeNull();
    });

    it('is neutral, with no number, when the stats cannot be read', async () => {
      await answer({ unexpected: true });

      expect(text(trustLine())).toBe('Counted from Rivals Pulse player uploads');
      expect(element.textContent).not.toMatch(/NaN|\b0 matches/);
    });
  });
});
