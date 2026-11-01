import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { fullHomeContent } from './home-content.fixtures';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
    fixture = TestBed.createComponent(HomePageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();

    http.expectOne('/api/home/content').flush(fullHomeContent);
    http.expectOne('/api/hero-stats').flush({
      status: 'not-enough-data',
      minimumMatches: 10,
      halfSeasons: [],
      halfSeason: null,
      inPlaceOf: null,
      matchesCounted: 0,
      tiers: [],
      belowMinimum: [],
    });
    http.expectOne('/api/heroes').flush([]);
    await settle();
  });

  afterEach(() => {
    // Stops the Jarvis core's animation frame loop between specs.
    fixture.destroy();
    http.verify();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const player = (): HTMLElement => element.querySelector('.home-page-background') as HTMLElement;
  const video = (): HTMLVideoElement => element.querySelector('video') as HTMLVideoElement;
  const soundToggle = (): HTMLButtonElement => element.querySelector('.home-page-sound-toggle') as HTMLButtonElement;
  const watchButton = (): HTMLButtonElement => element.querySelector('.actions__watch') as HTMLButtonElement;
  const closeButton = (): HTMLButtonElement | null => element.querySelector('.home-page-video-close');

  describe('the page structure', () => {
    it('has one h1, then an h2 for each band in visual order', () => {
      expect(element.querySelectorAll('h1').length).toBe(1);
      expect(Array.from(element.querySelectorAll('h2')).map(text)).toEqual([
        'What the overlay does',
        'Hero stats',
        'Tools',
        'How it works',
        "What's new in the game",
        'Frequently asked questions',
        'Get Rivals Pulse',
      ]);
    });

    it('holds every band in the one <main>, each a section labelled by its own h2, and has no aside', () => {
      const main = element.querySelector('main') as HTMLElement;
      const bands = Array.from(main.querySelectorAll<HTMLElement>('section.band'));

      expect(element.querySelectorAll('main').length).toBe(1);
      expect(bands.length).toBe(7);
      expect(bands.every((band) => main.contains(band))).toBeTrue();
      expect(bands.map((band) => band.getAttribute('aria-labelledby'))).toEqual(
        bands.map((band) => band.querySelector('h2')?.id ?? null),
      );
      expect(element.querySelector('aside')).toBeNull();
    });

    it('alternates dark, light, white, light, white, light and dark bands', () => {
      const tones = Array.from(element.querySelectorAll('main section.band')).map((band) =>
        band.classList.contains('band--dark') ? 'dark' : band.classList.contains('band--white') ? 'white' : 'light',
      );

      expect(tones).toEqual(['dark', 'light', 'white', 'light', 'white', 'light', 'dark']);
    });

    it('uses the one shared get-app button in the hero, the Jarvis console and the closing band', () => {
      const buttons = Array.from(element.querySelectorAll('app-get-app-button'));

      expect(buttons.length).toBe(3);
      expect(buttons.map((button) => button.parentElement?.closest('app-hero-overlay-actions, app-jarvis-console, app-closing-cta')?.tagName.toLowerCase())).toEqual([
        'app-hero-overlay-actions',
        'app-jarvis-console',
        'app-closing-cta',
      ]);
    });

    it('keeps every news block in the news band, and none in the hero', () => {
      const hero = element.querySelector('header.season-hero') as HTMLElement;

      expect(hero.querySelector('aside, section, a[target="_blank"]')).toBeNull();
      expect(element.querySelector('app-season-glance, app-season-dashboard, .hero-sidecar')).toBeNull();
      expect(text(element.querySelector('app-game-news-band'))).toContain('Step into Season 10');
    });

    it('keeps the Jarvis console reachable at #jarvis-console, which the header orb links to', () => {
      expect(element.querySelector('#jarvis-console')).toBeTruthy();
    });

    it('makes no Jarvis or player-rank claim in the hero', () => {
      const hero = text(element.querySelector('header.season-hero'));

      expect(hero).not.toMatch(/jarvis|twelve|\branks?\b|voice|free/i);
    });

    it('sets every heading from the shared type-scale tokens, in a modest size', () => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const size = (token: string): number => {
        probe.style.fontSize = `var(${token})`;

        return parseFloat(getComputedStyle(probe).fontSize);
      };
      const sizes = { hero: size('--type-hero'), h2: size('--type-h2'), h3: size('--type-h3') };
      probe.remove();

      expect(sizes.hero).toBeGreaterThanOrEqual(36);
      expect(sizes.hero).toBeLessThanOrEqual(60);
      expect(sizes.h2).toBeGreaterThanOrEqual(24);
      expect(sizes.h2).toBeLessThanOrEqual(32);
      expect(sizes.h3).toBe(18);
    });

    it('sizes the video background to the hero, in a wrapper of its own', () => {
      const stage = element.querySelector('.hero-stage') as HTMLElement;

      expect(stage.contains(player())).toBeTrue();
      expect(stage.contains(element.querySelector('header.season-hero'))).toBeTrue();
      expect(stage.contains(element.querySelector('main'))).toBeFalse();
    });
  });

  describe('the update video', () => {
    it('opens in the foreground from "Watch update video" in the news band, and focus moves to Close', async () => {
      watchButton().click();
      await settle();

      expect(player().classList).toContain('is-foreground');
      expect(player().getAttribute('role')).toBe('dialog');
      expect(player().getAttribute('aria-modal')).toBe('true');
      expect(closeButton()).toBeTruthy();
      expect(document.activeElement).toBe(closeButton());
    });

    it('closes on Escape and returns focus to the button that opened it', async () => {
      watchButton().focus();
      watchButton().click();
      await settle();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(player().classList).not.toContain('is-foreground');
      expect(closeButton()).toBeNull();
      expect(document.activeElement).toBe(watchButton());
    });

    it('closes with its Close button', async () => {
      watchButton().click();
      await settle();

      closeButton()?.click();
      await settle();

      expect(player().classList).not.toContain('is-foreground');
    });

    it('opens from a click on the video itself, and again closes on a second click', async () => {
      player().click();
      await settle();
      expect(player().classList).toContain('is-foreground');

      player().click();
      await settle();
      expect(player().classList).not.toContain('is-foreground');
    });

    it('opens with Enter and Space on the focused video', async () => {
      for (const key of ['Enter', ' ']) {
        player().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
        await settle();
        expect(player().classList).toContain('is-foreground');

        closeButton()?.click();
        await settle();
      }
    });
  });

  describe('the sound', () => {
    it('starts muted and toggles on and off, with its label and pressed state', async () => {
      expect(text(soundToggle())).toBe('Sound off');
      expect(soundToggle().getAttribute('aria-pressed')).toBe('false');
      expect(video().muted).toBeTrue();

      soundToggle().click();
      await settle();

      expect(text(soundToggle())).toBe('Sound on');
      expect(soundToggle().getAttribute('aria-pressed')).toBe('true');
      expect(video().muted).toBeFalse();

      soundToggle().click();
      await settle();

      expect(text(soundToggle())).toBe('Sound off');
      expect(video().muted).toBeTrue();
    });
  });

  describe('the popout', () => {
    const scrollWithHeroBottomAt = async (bottom: number): Promise<void> => {
      const hero = element.querySelector('header.season-hero') as HTMLElement;

      spyOn(hero, 'getBoundingClientRect').and.returnValue({ bottom } as DOMRect);
      window.dispatchEvent(new Event('scroll'));
      await settle();
    };

    it('floats the video once the hero has scrolled past', async () => {
      await scrollWithHeroBottomAt(40);

      expect(player().classList).toContain('is-popout');
      expect(player().getAttribute('aria-label')).toBe('Open the floating video player');
    });

    it('stays docked while the hero is still in view', async () => {
      await scrollWithHeroBottomAt(400);

      expect(player().classList).not.toContain('is-popout');
    });
  });
});
