import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { fullHomeContent } from './home-content.fixtures';
import { HOME_HERO_VIDEO_STORAGE_KEY } from './home-hero-video-preference.service';
import { HomePageComponent } from './home-page.component';

describe('HomePageComponent', () => {
  let fixture: ComponentFixture<HomePageComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(HomePageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();

    // The services behind the page keep what they fetched, so a second render asks for less.
    http.match('/api/home/content').forEach((request) => request.flush(fullHomeContent));
    http.match('/api/hero-stats').forEach((request) =>
      request.flush({
        status: 'not-enough-data',
        minimumMatches: 10,
        halfSeasons: [],
        halfSeason: null,
        inPlaceOf: null,
        matchesCounted: 0,
        tiers: [],
        belowMinimum: [],
      }),
    );
    http.match('/api/glossary').forEach((request) => request.flush([]));
    await settle();
  }

  function configure(): void {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(async () => {
    // The hero video starts off, so the tests about the video start from a visitor who turned it on.
    localStorage.setItem(HOME_HERO_VIDEO_STORAGE_KEY, 'on');
    configure();
    spyOn(console, 'error');
    await render();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
    localStorage.removeItem(HOME_HERO_VIDEO_STORAGE_KEY);
  });

  /** A new visit: nothing is kept in memory, so the choice has to come back from storage. */
  async function visit(saved: 'on' | 'off' | null): Promise<void> {
    fixture.destroy();
    http.verify();
    TestBed.resetTestingModule();

    if (saved) {
      localStorage.setItem(HOME_HERO_VIDEO_STORAGE_KEY, saved);
    } else {
      localStorage.removeItem(HOME_HERO_VIDEO_STORAGE_KEY);
    }

    configure();
    await render();
  }

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
  const videoToggle = (): HTMLButtonElement => element.querySelector('.home-page-video-toggle') as HTMLButtonElement;
  const banner = (): HTMLElement => element.querySelector('app-pulse-banner') as HTMLElement;
  const hero = (): HTMLElement => element.querySelector('header.season-hero') as HTMLElement;

  describe('the page structure', () => {
    it('has one h1, then an h2 for each band in visual order', () => {
      expect(element.querySelectorAll('h1').length).toBe(1);
      expect(Array.from(element.querySelectorAll('h2')).map(text)).toEqual([
        'The overlay does the work while you play',
        'Free hero stats, tier list and counters',
        'How it works',
        "What's new in the game",
        'Frequently asked questions',
        'Get RivalsPulse',
      ]);
    });

    it('says what RivalsPulse gives you in the eyebrow above the h1', () => {
      const hero = element.querySelector('.hero-copy') as HTMLElement;

      expect(hero.firstElementChild?.tagName).toBe('APP-EYEBROW');
      expect(text(hero.querySelector('app-eyebrow'))).toBe('Live counters in game. Real stats on the web.');
      expect(hero.firstElementChild?.nextElementSibling?.tagName).toBe('H1');
    });

    it('says in the h1 and one paragraph what the free Overwolf app does, in game and on the site', () => {
      const hero = element.querySelector('.hero-copy') as HTMLElement;
      const lede = text(hero.querySelector('.lede'));

      expect(text(hero.querySelector('h1'))).toBe('Feel the pulse of every match.');
      expect(hero.querySelectorAll('p.lede').length).toBe(1);
      expect(lede).toContain('RivalsPulse is a free Overwolf app for Marvel Rivals.');
      expect(lede).toContain('counters, the tier list and any hero over the game');
      expect(lede).toContain("it won't get you banned: here's why.");
      expect(hero.querySelector('.lede a')?.getAttribute('href')).toBe('/faq#ban-risk');
    });

    it('puts the heading first in every band, which carries no decorative eyebrow of its own', () => {
      const bands = Array.from(element.querySelectorAll<HTMLElement>('section.band'));

      expect(element.querySelectorAll('.band__head app-eyebrow').length).toBe(0);
      expect(bands.length).toBe(6);
      for (const band of bands) {
        const heading = band.querySelector('h2') as HTMLElement;

        expect(text(band).startsWith(text(heading))).toBeTrue();
      }
    });

    it('leaves the main landmark to the shell, keeps each band a section labelled by its own h2, and has no aside', () => {
      const bands = Array.from(element.querySelectorAll<HTMLElement>('section.band'));

      expect(element.querySelector('main')).toBeNull();
      expect(bands.length).toBe(6);
      expect(bands.map((band) => band.getAttribute('aria-labelledby'))).toEqual(
        bands.map((band) => band.querySelector('h2')?.id ?? null),
      );
      expect(element.querySelector('aside')).toBeNull();
    });

    it('alternates light and white bands, closing on light', () => {
      const tones = Array.from(element.querySelectorAll('section.band')).map((band) =>
        band.classList.contains('band--white') ? 'white' : 'light',
      );

      expect(tones).toEqual(['light', 'white', 'light', 'white', 'light', 'light']);
    });

    it('uses the one shared get-app button in the hero and the closing band', () => {
      const buttons = Array.from(element.querySelectorAll('app-get-app-button'));

      expect(buttons.length).toBe(2);
      expect(buttons.map((button) => button.parentElement?.closest('app-hero-overlay-actions, app-closing-cta')?.tagName.toLowerCase())).toEqual([
        'app-hero-overlay-actions',
        'app-closing-cta',
      ]);
    });

    it('keeps every news block in the news band, and none in the hero', () => {
      const hero = element.querySelector('header.season-hero') as HTMLElement;

      expect(hero.querySelector('aside, section, a[target="_blank"]')).toBeNull();
      expect(element.querySelector('app-season-glance, app-season-dashboard, .hero-sidecar')).toBeNull();
      expect(text(element.querySelector('app-game-news-band'))).toContain('Step into Season 10');
    });

    it('makes no Pulsa, hotkey or player-rank claim in the hero', () => {
      const hero = text(element.querySelector('header.season-hero'));

      expect(hero).not.toMatch(/pulsa|hotkey|twelve|\branks?\b|voice/i);
    });

    it('sets every heading from the shared type-scale tokens, in a modest size', () => {
      const probe = document.createElement('div');
      document.body.appendChild(probe);
      const size = (token: string): number => {
        probe.style.fontSize = `var(${token})`;

        return parseFloat(getComputedStyle(probe).fontSize);
      };
      const sizes = {
        hero: size('--type-hero'),
        pageTitle: size('--type-page-title'),
        h2: size('--type-h2'),
        h3: size('--type-h3'),
      };
      probe.remove();

      expect(sizes.hero).toBeGreaterThanOrEqual(36);
      expect(sizes.hero).toBeLessThanOrEqual(60);
      expect(sizes.pageTitle).toBeGreaterThanOrEqual(28);
      expect(sizes.pageTitle).toBeLessThanOrEqual(40);
      expect(sizes.h2).toBeGreaterThanOrEqual(24);
      expect(sizes.h2).toBeLessThanOrEqual(32);
      expect(sizes.h3).toBe(18);
    });

    it('sizes the video background to the hero, in a wrapper of its own', () => {
      const stage = element.querySelector('.hero-stage') as HTMLElement;

      expect(stage.contains(player())).toBeTrue();
      expect(stage.contains(element.querySelector('header.season-hero'))).toBeTrue();
      expect(stage.contains(element.querySelector('section.band'))).toBeFalse();
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

    it('plays the video straight from the click when it is already there, before any render', () => {
      const play = spyOn(video(), 'play').and.resolveTo();

      watchButton().click();

      expect(play).toHaveBeenCalledTimes(1);
    });

    it('plays the video once it is rendered when the hero video was off', async () => {
      videoToggle().click();
      await settle();
      const play = spyOn(HTMLMediaElement.prototype, 'play').and.resolveTo();

      watchButton().click();
      expect(play).not.toHaveBeenCalled();
      await settle();

      expect(play).toHaveBeenCalled();
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

  describe('the hero video switch', () => {
    async function toggle(): Promise<void> {
      videoToggle().click();
      await settle();
    }

    const nextVisit = (): Promise<void> => visit(localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY) === 'on' ? 'on' : 'off');

    it('is on when the visitor saved "on": the video plays in the background and the banner is a strip', () => {
      expect(text(videoToggle())).toBe('Video on');
      expect(videoToggle().getAttribute('aria-pressed')).toBe('true');
      expect(videoToggle().type).toBe('button');
      expect(videoToggle().getAttribute('aria-label')).toBe('Background video');
      expect(video()).toBeTruthy();
      expect(banner().getAttribute('data-layout')).toBe('strip');
      expect(hero().classList).not.toContain('has-pulse-backdrop');
    });

    describe('with no saved choice', () => {
      beforeEach(() => visit(null));

      it('starts off: no video is in the page to download, the controls that belong to it are hidden and the banner fills the hero', () => {
        expect(text(videoToggle())).toBe('Video off');
        expect(videoToggle().getAttribute('aria-pressed')).toBe('false');
        expect(videoToggle().type).toBe('button');
        expect(videoToggle().getAttribute('aria-label')).toBe('Background video');
        expect(video()).toBeNull();
        expect(element.querySelector('[src$=".mp4"], [src$=".webm"]')).toBeNull();
        expect(player()).toBeNull();
        expect(soundToggle()).toBeNull();
        expect(banner().getAttribute('data-layout')).toBe('backdrop');
        expect(hero().classList).toContain('has-pulse-backdrop');
      });

      it('plays the video, muted, once the visitor turns it on', async () => {
        await toggle();
        const playing = video();
        const play = spyOn(playing, 'play').and.resolveTo();

        playing.dispatchEvent(new Event('canplay'));

        expect(text(videoToggle())).toBe('Video on');
        expect(playing.getAttribute('src')).toBeTruthy();
        expect(playing.muted).toBeTrue();
        expect(play).toHaveBeenCalledTimes(1);
        expect(banner().getAttribute('data-layout')).toBe('strip');
      });

      it('opens the update video from the news band without ever turning the hero video on', async () => {
        watchButton().click();
        await settle();

        expect(player().classList).toContain('is-foreground');
        expect(video().getAttribute('src')).toBeTruthy();
        expect(text(videoToggle())).toBe('Video off');
      });
    });

    it('keeps the video off on the next visit after a saved "off"', async () => {
      await visit('off');

      expect(text(videoToggle())).toBe('Video off');
      expect(video()).toBeNull();
    });

    it('sits next to the sound toggle, last in the row so it stays at the edge when the sound toggle goes', async () => {
      const row = element.querySelector('.hero-controls') as HTMLElement;

      expect(Array.from(row.children)).toEqual([soundToggle(), videoToggle()]);

      await toggle();

      expect(Array.from(row.children)).toEqual([videoToggle()]);
    });

    it('keeps one name, "Background video", while the pressed state changes, so a screen reader does not contradict itself', async () => {
      const label = videoToggle().getAttribute('aria-label');

      await toggle();

      expect(videoToggle().getAttribute('aria-label')).toBe(label);
      expect(videoToggle().getAttribute('aria-pressed')).toBe('false');
      expect(videoToggle().querySelector('[aria-hidden="true"]')?.textContent).toBe('off');
    });

    it('turns the video off: it is gone, the controls that belong to it are hidden and the banner fills the hero', async () => {
      await toggle();

      expect(text(videoToggle())).toBe('Video off');
      expect(videoToggle().getAttribute('aria-pressed')).toBe('false');
      expect(video()).toBeNull();
      expect(player()).toBeNull();
      expect(soundToggle()).toBeNull();
      expect(element.querySelector('.home-page-video-controls, .home-page-video-tab')).toBeNull();
      expect(banner().getAttribute('data-layout')).toBe('backdrop');
      expect(hero().classList).toContain('has-pulse-backdrop');
    });

    it('pauses the video and lets go of its download as it turns it off', async () => {
      const playing = video();
      const pause = spyOn(playing, 'pause').and.callThrough();
      spyOn(playing, 'load');

      await toggle();

      expect(pause).toHaveBeenCalled();
      expect(playing.hasAttribute('src')).toBeFalse();
    });

    it('keeps the h1 as the only heading and the banner name as plain text, in both modes', async () => {
      for (let pass = 0; pass < 2; pass++) {
        expect(element.querySelectorAll('h1').length).toBe(1);
        expect(banner().querySelector('.pulse-banner__name')?.tagName).toBe('P');
        expect(banner().querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
        await toggle();
      }
    });

    it('stays a focusable native button after it is pressed, so the keyboard can switch it back', async () => {
      videoToggle().focus();
      await toggle();

      expect(videoToggle().tabIndex).toBe(0);
      expect(document.activeElement).toBe(videoToggle());
    });

    it("turns the video back on with today's hero: the video, the sound toggle and the banner strip", async () => {
      await toggle();
      await toggle();

      expect(text(videoToggle())).toBe('Video on');
      expect(videoToggle().getAttribute('aria-pressed')).toBe('true');
      expect(video()).toBeTruthy();
      expect(video().getAttribute('src')).toBeTruthy();
      expect(text(soundToggle())).toBe('Sound off');
      expect(banner().getAttribute('data-layout')).toBe('strip');
      expect(hero().classList).not.toContain('has-pulse-backdrop');
    });

    it('brings the video back muted, even if the sound was on when it was turned off', async () => {
      soundToggle().click();
      await settle();
      expect(video().muted).toBeFalse();

      await toggle();
      await toggle();

      expect(video().muted).toBeTrue();
      expect(text(soundToggle())).toBe('Sound off');
    });

    it('does not float or minimize a video that is off, however far the visitor scrolls', async () => {
      await toggle();
      spyOn(hero(), 'getBoundingClientRect').and.returnValue({ bottom: -900 } as DOMRect);

      window.dispatchEvent(new Event('scroll'));
      await settle();

      expect(player()).toBeNull();
      expect(element.querySelector('.home-page-video-tab')).toBeNull();
      expect(document.documentElement.classList).not.toContain('has-minimized-video');
    });

    it('remembers the choice: the next visit opens with the video off', async () => {
      await toggle();
      expect(localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('off');

      await nextVisit();

      expect(text(videoToggle())).toBe('Video off');
      expect(video()).toBeNull();
      expect(banner().getAttribute('data-layout')).toBe('backdrop');
    });

    it('remembers turning it back on', async () => {
      await toggle();
      await toggle();
      expect(localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('on');

      await nextVisit();

      expect(text(videoToggle())).toBe('Video on');
      expect(video()).toBeTruthy();
    });

    it('opens the update video from the news band while the hero video is off, then lets it go again', async () => {
      await toggle();
      expect(video()).toBeNull();

      watchButton().focus();
      watchButton().click();
      await settle();

      expect(player().classList).toContain('is-foreground');
      expect(video().getAttribute('src')).toBeTruthy();
      expect(document.activeElement).toBe(closeButton());
      expect(soundToggle()).toBeNull();

      closeButton()?.click();
      await settle();

      expect(video()).toBeNull();
      expect(player()).toBeNull();
      expect(document.activeElement).toBe(watchButton());
      expect(text(videoToggle())).toBe('Video off');
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
    let heroBottom = 400;

    const scrollWithHeroBottomAt = async (bottom: number): Promise<void> => {
      heroBottom = bottom;
      window.dispatchEvent(new Event('scroll'));
      await settle();
    };
    const floatingControl = (name: string): HTMLButtonElement | null =>
      Array.from(element.querySelectorAll<HTMLButtonElement>('.home-page-video-control')).find(
        (button) => text(button) === name,
      ) ?? null;
    const minimizeButton = (): HTMLButtonElement | null => floatingControl('Minimize');
    const backButton = (): HTMLButtonElement | null => floatingControl('Back to background');
    const tab = (): HTMLButtonElement | null => element.querySelector('.home-page-video-tab');

    let main: HTMLElement;

    beforeEach(() => {
      main = document.createElement('main');
      main.id = 'main-content';
      main.tabIndex = -1;
      document.body.appendChild(main);
      heroBottom = 400;
      const hero = element.querySelector('header.season-hero') as HTMLElement;

      spyOn(hero, 'getBoundingClientRect').and.callFake(() => ({ bottom: heroBottom }) as DOMRect);
    });

    afterEach(() => main.remove());

    it('floats the video once the hero has scrolled past', async () => {
      await scrollWithHeroBottomAt(40);

      expect(player().classList).toContain('is-popout');
      expect(player().getAttribute('aria-label')).toBe('Open the floating video player');
    });

    it('stays docked while the hero is still in view', async () => {
      await scrollWithHeroBottomAt(400);

      expect(player().classList).not.toContain('is-popout');
      expect(minimizeButton()).toBeNull();
      expect(backButton()).toBeNull();
      expect(tab()).toBeNull();
    });

    it('offers Minimize and Back to background on the floating player, as buttons outside the player surface', async () => {
      await scrollWithHeroBottomAt(40);

      expect(minimizeButton()?.type).toBe('button');
      expect(backButton()?.type).toBe('button');
      expect(player().contains(minimizeButton())).toBeFalse();
      expect(player().contains(backButton())).toBeFalse();
    });

    it('minimizes to a tab at the bottom, hides the player and moves focus to the tab', async () => {
      await scrollWithHeroBottomAt(40);

      minimizeButton()?.click();
      await settle();

      expect(player().classList).toContain('is-minimized');
      expect(player().classList).not.toContain('is-popout');
      expect(getComputedStyle(player()).display).toBe('none');
      expect(minimizeButton()).toBeNull();
      expect(backButton()).toBeNull();
      expect(text(tab())).toBe('Show video');
      expect(tab()?.getAttribute('aria-label')).toBe('Show the floating video player');
      expect(document.activeElement).toBe(tab());
    });

    it('restores the floating player from the tab and returns focus to Minimize', async () => {
      await scrollWithHeroBottomAt(40);
      minimizeButton()?.click();
      await settle();

      tab()?.click();
      await settle();

      expect(player().classList).toContain('is-popout');
      expect(player().classList).not.toContain('is-minimized');
      expect(tab()).toBeNull();
      expect(document.activeElement).toBe(minimizeButton());
    });

    it('stays minimized while scrolling, even back through the hero and down again', async () => {
      await scrollWithHeroBottomAt(40);
      minimizeButton()?.click();
      await settle();

      await scrollWithHeroBottomAt(10);
      expect(tab()).toBeTruthy();

      await scrollWithHeroBottomAt(400);
      expect(tab()).toBeNull();
      expect(player().classList).not.toContain('is-minimized');

      await scrollWithHeroBottomAt(-900);
      expect(tab()).toBeTruthy();
      expect(player().classList).toContain('is-minimized');
      expect(player().classList).not.toContain('is-popout');
    });

    it('sends the video back to the hero background and keeps it there however far the visitor scrolls', async () => {
      await scrollWithHeroBottomAt(40);

      backButton()?.click();
      await settle();

      expect(player().classList).not.toContain('is-popout');
      expect(player().classList).not.toContain('is-minimized');
      expect(minimizeButton()).toBeNull();
      expect(tab()).toBeNull();

      await scrollWithHeroBottomAt(-3000);
      expect(player().classList).not.toContain('is-popout');
      expect(tab()).toBeNull();

      await scrollWithHeroBottomAt(400);
      await scrollWithHeroBottomAt(-3000);
      expect(player().classList).not.toContain('is-popout');
    });

    it('still opens the foreground player from "Watch update video" after Back to background', async () => {
      await scrollWithHeroBottomAt(40);
      backButton()?.click();
      await settle();

      watchButton().click();
      await settle();

      expect(player().classList).toContain('is-foreground');
      expect(document.activeElement).toBe(closeButton());

      closeButton()?.click();
      await settle();

      expect(player().classList).not.toContain('is-foreground');
      expect(player().classList).not.toContain('is-popout');
    });

    it('still opens the foreground player from "Watch update video" while minimized, and returns to the tab on close', async () => {
      await scrollWithHeroBottomAt(40);
      minimizeButton()?.click();
      await settle();

      watchButton().click();
      await settle();

      expect(player().classList).toContain('is-foreground');
      expect(getComputedStyle(player()).display).not.toBe('none');
      expect(tab()).toBeNull();

      closeButton()?.click();
      await settle();

      expect(player().classList).toContain('is-minimized');
      expect(tab()).toBeTruthy();
    });

    it('does not open the foreground player when any of the controls is used', async () => {
      await scrollWithHeroBottomAt(40);

      minimizeButton()?.click();
      await settle();
      expect(player().classList).not.toContain('is-foreground');

      tab()?.click();
      await settle();
      expect(player().classList).not.toContain('is-foreground');

      backButton()?.click();
      await settle();
      expect(player().classList).not.toContain('is-foreground');
    });

    it('keeps the foreground player free of the floating controls', async () => {
      await scrollWithHeroBottomAt(40);

      player().click();
      await settle();

      expect(player().classList).toContain('is-foreground');
      expect(minimizeButton()).toBeNull();
      expect(backButton()).toBeNull();
    });

    it('puts both controls in the tab order, Minimize first', async () => {
      await scrollWithHeroBottomAt(40);

      const controls = Array.from(element.querySelectorAll<HTMLButtonElement>('.home-page-video-control'));

      expect(controls.map(text)).toEqual(['Minimize', 'Back to background']);
      expect(controls.every((control) => control.tabIndex === 0)).toBeTrue();
    });

    it('mutes the video when it is minimized, and the sound toggle says so', async () => {
      await scrollWithHeroBottomAt(40);
      soundToggle().click();
      await settle();
      expect(video().muted).toBeFalse();

      minimizeButton()?.click();
      await settle();

      expect(video().muted).toBeTrue();
      expect(text(soundToggle())).toBe('Sound off');
      expect(soundToggle().getAttribute('aria-pressed')).toBe('false');
    });

    it('mutes the video when it is sent back to the background, and the sound toggle says so', async () => {
      await scrollWithHeroBottomAt(40);
      soundToggle().click();
      await settle();
      expect(video().muted).toBeFalse();

      backButton()?.click();
      await settle();

      expect(video().muted).toBeTrue();
      expect(text(soundToggle())).toBe('Sound off');
    });

    it('moves focus to the main landmark, without scrolling, when Back to background removes the focused button', async () => {
      await scrollWithHeroBottomAt(40);
      const focusMain = spyOn(main, 'focus').and.callThrough();
      backButton()?.focus();

      backButton()?.click();
      await settle();

      expect(focusMain).toHaveBeenCalledOnceWith({ preventScroll: true });
      expect(document.activeElement).toBe(main);
    });

    it('moves focus to the main landmark when the hero scrolls back into view while the tab has focus', async () => {
      await scrollWithHeroBottomAt(40);
      minimizeButton()?.click();
      await settle();
      expect(document.activeElement).toBe(tab());

      await scrollWithHeroBottomAt(400);

      expect(tab()).toBeNull();
      expect(document.activeElement).toBe(main);
    });

    it('leaves focus alone when the visitor is elsewhere on the page as the player changes', async () => {
      const other = document.createElement('button');
      document.body.appendChild(other);
      other.focus();

      await scrollWithHeroBottomAt(40);
      await scrollWithHeroBottomAt(400);

      expect(document.activeElement).toBe(other);
      other.remove();
    });

    it('reserves the tab height below the end of the page only while minimized', async () => {
      const bottomPadding = (): string => getComputedStyle(document.body).paddingBottom;
      const tabHeight = (): string =>
        getComputedStyle(document.documentElement).getPropertyValue('--floating-video-tab-height').trim();

      await scrollWithHeroBottomAt(40);
      expect(bottomPadding()).toBe('0px');

      minimizeButton()?.click();
      await settle();
      expect(bottomPadding()).toBe(tabHeight());
      expect(tabHeight()).not.toBe('');
      expect(tab()?.getBoundingClientRect().height).toBeGreaterThanOrEqual(parseFloat(tabHeight()));

      tab()?.click();
      await settle();
      expect(bottomPadding()).toBe('0px');

      minimizeButton()?.click();
      await settle();
      expect(bottomPadding()).toBe(tabHeight());

      await scrollWithHeroBottomAt(400);
      expect(bottomPadding()).toBe('0px');
    });

    it('gives the reserve back when the page is left while minimized', async () => {
      await scrollWithHeroBottomAt(40);
      minimizeButton()?.click();
      await settle();
      expect(document.documentElement.classList).toContain('has-minimized-video');

      fixture.destroy();

      expect(document.documentElement.classList).not.toContain('has-minimized-video');
    });
  });
});
