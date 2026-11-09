import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, ThemeService } from '../../../core/theme/theme.service';
import { CircuitGrid } from './circuit-grid';
import { PulseBannerComponent } from './pulse-banner.component';

describe('PulseBannerComponent', () => {
  let fixture: ComponentFixture<PulseBannerComponent>;
  let setPlayback: jasmine.Spy;
  let setPalette: jasmine.Spy;

  function create(reducedMotion = false): void {
    const real = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake(query =>
      query === '(prefers-reduced-motion: reduce)'
        ? ({ matches: reducedMotion, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList)
        : real(query));
    fixture = TestBed.createComponent(PulseBannerComponent);
    fixture.detectChanges();
  }

  function banner(): HTMLElement {
    return fixture.nativeElement.querySelector('.pulse-banner') as HTMLElement;
  }

  /** Lets the intersection observer report. */
  function settle(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 100));
  }

  // The layout specs size the box that holds the banner, which is the page's body: put it back.
  let bodyStyle = '';
  beforeEach(() => (bodyStyle = document.body.style.cssText));
  afterEach(() => (document.body.style.cssText = bodyStyle));

  beforeEach(() => {
    setPlayback = spyOn(CircuitGrid.prototype, 'setPlayback');
    setPalette = spyOn(CircuitGrid.prototype, 'setPalette');
    TestBed.configureTestingModule({ imports: [PulseBannerComponent], providers: [provideZonelessChangeDetection()] });
  });

  describe('the name and the decoration', () => {
    beforeEach(() => create());

    it('shows Rivals Pulse as plain text and not as a heading, so the page keeps one h1', () => {
      expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim()).toBe('Rivals Pulse');
      expect(banner().querySelector('.pulse-banner__name')?.tagName).toBe('P');
      expect(banner().querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
    });

    it('hides the circuit grid, the clash and the spark from screen readers', () => {
      expect(banner().querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
      expect(banner().querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
      expect(banner().querySelector('.pulse-banner__spark')?.textContent?.trim()).toBe('');
    });

    it('keeps the spark out of the stretched drawing, so it stays round at any width', () => {
      expect(banner().querySelector('svg .pulse-banner__spark')).toBeNull();
      expect(banner().querySelector('svg circle')).toBeNull();
    });
  });

  describe('the layout', () => {
    it('is a strip unless the owner asks for a backdrop', () => {
      create();

      expect(fixture.nativeElement.getAttribute('data-layout')).toBe('strip');
    });

    it('fills the box that holds it as a backdrop, and sizes its grid to that box', async () => {
      const resize = spyOn(CircuitGrid.prototype, 'resize');
      create();
      const box = fixture.nativeElement.parentElement as HTMLElement;
      box.style.cssText = 'position: relative; width: 640px; height: 400px';
      fixture.componentRef.setInput('layout', 'backdrop');
      fixture.detectChanges();
      await settle();

      expect(fixture.nativeElement.getAttribute('data-layout')).toBe('backdrop');
      expect(getComputedStyle(banner()).height).toBe('400px');
      expect(getComputedStyle(banner()).borderTopWidth).toBe('0px');
      expect(resize.calls.mostRecent().args.slice(0, 2)).toEqual([640, 400]);
    });

    it('keeps the clash in a band of the height the owner gives it, with the name and spark in that band', () => {
      create();
      fixture.componentRef.setInput('layout', 'backdrop');
      fixture.detectChanges();
      const box = fixture.nativeElement.parentElement as HTMLElement;
      box.style.cssText = 'position: relative; width: 600px; height: 400px; --pulse-stage-height: 180px';
      const stage = banner().querySelector('.pulse-banner__stage') as HTMLElement;

      expect(stage.getBoundingClientRect().height).toBe(180);
      for (const part of ['svg', '.pulse-banner__spark', '.pulse-banner__name']) {
        expect(stage.querySelector(part)).withContext(part).toBeTruthy();
      }
    });

    it('is a decoration that never takes a click from the copy over it', () => {
      create();
      fixture.componentRef.setInput('layout', 'backdrop');
      fixture.detectChanges();

      expect(getComputedStyle(fixture.nativeElement).pointerEvents).toBe('none');
    });

    it('goes back to the framed strip when the owner asks for one again', () => {
      create();
      fixture.componentRef.setInput('layout', 'backdrop');
      fixture.detectChanges();
      fixture.componentRef.setInput('layout', 'strip');
      fixture.detectChanges();

      expect(fixture.nativeElement.getAttribute('data-layout')).toBe('strip');
      expect(getComputedStyle(banner()).height).toBe('128px');
    });
  });

  describe('motion', () => {
    /**
     * Stands in for the browser's observer, so a spec says when the banner is on screen instead of
     * depending on where the headless runner's window and scroll happen to be.
     */
    class FakeIntersectionObserver {
      static latest: FakeIntersectionObserver | null = null;

      constructor(private readonly callback: IntersectionObserverCallback) {
        FakeIntersectionObserver.latest = this;
      }

      observe(): void {}
      disconnect(): void {}

      report(isIntersecting: boolean): void {
        this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      }
    }

    const realIntersectionObserver = window.IntersectionObserver;
    beforeEach(() => {
      FakeIntersectionObserver.latest = null;
      window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    });
    afterEach(() => (window.IntersectionObserver = realIntersectionObserver));

    it('plays once it is on screen, and holds when the tab is hidden', async () => {
      const hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
      create();
      await fixture.whenStable();

      expect(setPlayback).not.toHaveBeenCalledWith('playing');

      FakeIntersectionObserver.latest!.report(true);

      expect(setPlayback.calls.mostRecent().args).toEqual(['playing']);

      hidden.and.returnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));

      expect(setPlayback.calls.mostRecent().args).toEqual(['paused']);
      fixture.detectChanges();
      expect(banner().classList).toContain('pulse-banner--paused');
    });

    it('shows a still frame under prefers-reduced-motion, whatever is on screen', async () => {
      create(true);
      await settle();

      expect(setPlayback).toHaveBeenCalledWith('still');
      expect(setPlayback).not.toHaveBeenCalledWith('playing');
      expect(banner().classList).toContain('pulse-banner--still');
    });
  });

  describe('the theme', () => {
    afterEach(() => {
      localStorage.removeItem(THEME_STORAGE_KEY);
      document.documentElement.removeAttribute('data-theme');
    });

    it('reads the palette again when the theme changes', async () => {
      create();
      await settle();
      setPalette.calls.reset();

      TestBed.inject(ThemeService).toggleTheme();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(setPalette).toHaveBeenCalledTimes(1);
      const palette = setPalette.calls.mostRecent().args[0];
      expect(palette.line).not.toBe('');
      expect(palette.currents.every((colour: string) => colour !== '')).toBeTrue();
    });
  });
});
