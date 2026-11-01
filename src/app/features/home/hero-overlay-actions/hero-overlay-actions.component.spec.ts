import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
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

  it('leads with the shared get-app button, ahead of "See stats"', () => {
    const button = element.querySelector('app-get-app-button') as HTMLElement;

    expect(button).toBeTruthy();
    expect(text(button)).toContain('Get RivalsPulse on Overwolf');
    expect(button.nextElementSibling).toBe(element.querySelector('a.cta-ghost'));
  });

  it('sends "See stats" to /community', () => {
    const link = element.querySelector('a.cta-ghost') as HTMLAnchorElement;

    expect(text(link)).toBe('See stats');
    expect(link.getAttribute('href')).toBe('/community');
  });

  describe('the FAQ note', () => {
    const note = (): HTMLElement => element.querySelector('.safety-note') as HTMLElement;
    const link = (): HTMLAnchorElement => element.querySelector('a.safety-link') as HTMLAnchorElement;

    it('sits under the buttons and opens the FAQ, from the first render', () => {
      expect(link().getAttribute('href')).toBe('/faq');
      expect(text(link())).toBe("No — here's why");
      expect(text(note())).toBe("Will it get me banned? No — here's why");
      expect(note().previousElementSibling).toBe(element.querySelector('.hero-actions'));
      expect(note().nextElementSibling).toBe(element.querySelector('.trust-row'));
      expect(link().tabIndex).toBe(0);
    });

    it('answers the question without claiming the app is safe or ban-proof', () => {
      expect(text(note())).not.toMatch(/safe|ban-proof|endorsed|partnered/i);
    });
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

      expect(text(trustLine())).toBe('Counted from RivalsPulse player uploads');
      expect(element.textContent).not.toMatch(/NaN|\b0 matches/);
    });
  });

  describe('the How we count link', () => {
    const link = (): HTMLAnchorElement | null => element.querySelector('a.how-we-count');

    it('is not shown while the stats load', () => {
      expect(link()).toBeNull();
    });

    it('sits beside the trust line and opens the explainer', async () => {
      await answer(stats);

      expect(link()?.getAttribute('href')).toBe('/how-we-count');
      expect(text(link())).toBe('How we count');
      expect(link()?.previousElementSibling).toBe(trustLine());
      expect(link()?.tabIndex).toBe(0);
    });

    it('stays next to the neutral line shown when the stats cannot be read', async () => {
      await answer({ unexpected: true });

      expect(text(trustLine())).toBe('Counted from RivalsPulse player uploads');
      expect(link()?.getAttribute('href')).toBe('/how-we-count');
    });

    for (const width of [340, 1100]) {
      it(`does not change the height of the trust row or move the buttons or the FAQ note at ${width}px`, async () => {
        const frame = document.createElement('div');
        frame.style.width = `${width}px`;
        frame.appendChild(element);
        document.body.appendChild(frame);

        const buttons = element.querySelector('.hero-actions') as HTMLElement;
        const row = element.querySelector('.trust-row') as HTMLElement;
        const note = element.querySelector('.safety-note') as HTMLElement;
        const snapshot = () => ({
          row: row.offsetHeight,
          buttons: buttons.offsetTop,
          note: note.offsetTop,
          total: element.offsetHeight,
        });
        const before = snapshot();

        await answer(stats);
        const after = snapshot();
        frame.remove();

        expect(before.row).toBeGreaterThanOrEqual(24);
        expect(after).toEqual(before);
      });
    }
  });
});
