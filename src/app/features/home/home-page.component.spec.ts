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
    it('has one h1, then an h2 for each section', () => {
      expect(element.querySelectorAll('h1').length).toBe(1);
      expect(Array.from(element.querySelectorAll('h2')).map(text)).toEqual([
        'Hero stats',
        'What the overlay does',
        'Tools',
        'Game News',
      ]);
    });

    it('puts the sections in <main> and the news rail after it, in one labelled aside', () => {
      const main = element.querySelector('main') as HTMLElement;
      const asides = element.querySelectorAll('aside');

      expect(element.querySelectorAll('main').length).toBe(1);
      expect(asides.length).toBe(1);
      expect(asides[0].getAttribute('aria-labelledby')).toBe('game-news-title');
      expect(main.compareDocumentPosition(asides[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(main.contains(asides[0])).toBeFalse();
    });

    it('keeps every news block inside the rail, and none in the hero', () => {
      const hero = element.querySelector('header.season-hero') as HTMLElement;

      expect(hero.querySelector('aside, section, a[target="_blank"]')).toBeNull();
      expect(element.querySelector('app-season-glance, app-season-dashboard, .hero-sidecar')).toBeNull();
      expect(text(element.querySelector('aside'))).toContain('Step into Season 10');
    });
  });

  describe('the update video', () => {
    it('opens in the foreground from "Watch update video" in the rail, and focus moves to Close', async () => {
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
