import { Component, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CALM_LOOK, CircuitGrid } from '../../circuit/circuit-grid';
import { NavPulse } from './nav-pulse';

@Component({ template: '' })
class PageStub {}

/** Stands in for the browser's observer, so a spec says when the bar is on screen. */
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

describe('NavPulse', () => {
  let fixture: ComponentFixture<NavPulse>;
  let router: Router;
  let setPlayback: jasmine.Spy;
  const realIntersectionObserver = window.IntersectionObserver;

  const host = (): HTMLElement => fixture.nativeElement;

  async function open(url: string, reducedMotion = false): Promise<void> {
    const real = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake((query) =>
      query === '(prefers-reduced-motion: reduce)'
        ? ({ matches: reducedMotion, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList)
        : real(query),
    );
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(NavPulse);
    await fixture.whenStable();
  }

  const bringOnScreen = (): void => {
    expect(FakeIntersectionObserver.latest).withContext('the bar watches whether it is on screen').not.toBeNull();
    FakeIntersectionObserver.latest?.report(true);
  };

  beforeEach(() => {
    FakeIntersectionObserver.latest = null;
    window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    setPlayback = spyOn(CircuitGrid.prototype, 'setPlayback');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: '', component: PageStub },
          { path: 'heroes', component: PageStub },
          { path: 'tier-list', component: PageStub },
        ]),
      ],
    });
  });

  afterEach(() => (window.IntersectionObserver = realIntersectionObserver));

  it('is decoration: hidden from assistive technology, taking no click and no layout space', async () => {
    await open('/heroes');
    const style = getComputedStyle(host());

    expect(host().getAttribute('aria-hidden')).toBe('true');
    expect(style.pointerEvents).toBe('none');
    expect(style.position).toBe('absolute');
  });

  describe('on a subpage', () => {
    it('plays once the bar is on screen', async () => {
      spyOnProperty(document, 'hidden').and.returnValue(false);
      await open('/heroes');
      expect(setPlayback).not.toHaveBeenCalledWith('playing');

      bringOnScreen();

      expect(setPlayback.calls.mostRecent().args).toEqual(['playing']);
      expect(host().hidden).toBeFalse();
    });

    it('draws with the calm look, and with no clash and no pointer reaction', async () => {
      const setClash = spyOn(CircuitGrid.prototype, 'setClash');
      const setPointer = spyOn(CircuitGrid.prototype, 'setPointer');
      await open('/heroes');

      expect((setPlayback.calls.mostRecent().object as unknown as { look: unknown }).look).toBe(CALM_LOOK);
      document.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10, pointerType: 'mouse' }));
      expect(setClash).not.toHaveBeenCalled();
      expect(setPointer).not.toHaveBeenCalled();
    });

    it('holds when the tab is hidden, and plays again when it is back', async () => {
      const hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
      await open('/heroes');
      bringOnScreen();

      hidden.and.returnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(setPlayback.calls.mostRecent().args).toEqual(['paused']);

      hidden.and.returnValue(false);
      document.dispatchEvent(new Event('visibilitychange'));
      expect(setPlayback.calls.mostRecent().args).toEqual(['playing']);
    });

    it('shows a still frame under prefers-reduced-motion, whatever is on screen', async () => {
      spyOnProperty(document, 'hidden').and.returnValue(false);
      await open('/heroes', true);
      bringOnScreen();

      expect(setPlayback).toHaveBeenCalledWith('still');
      expect(setPlayback).not.toHaveBeenCalledWith('playing');
    });

    it('keeps the same grid, running, as the visitor moves between subpages', async () => {
      spyOnProperty(document, 'hidden').and.returnValue(false);
      const destroy = spyOn(CircuitGrid.prototype, 'destroy');
      await open('/heroes');
      bringOnScreen();
      const grid = setPlayback.calls.mostRecent().object;
      setPlayback.calls.reset();

      await router.navigateByUrl('/tier-list');
      await fixture.whenStable();

      expect(destroy).not.toHaveBeenCalled();
      expect(setPlayback).not.toHaveBeenCalledWith('paused');
      expect(setPlayback.calls.all().every((call) => call.object === grid)).toBeTrue();
    });
  });

  describe('on the home page', () => {
    it('is hidden and never plays, because the banner has its own pulse', async () => {
      spyOnProperty(document, 'hidden').and.returnValue(false);
      await open('/');
      bringOnScreen();

      expect(host().hidden).toBeTrue();
      expect(getComputedStyle(host()).display).toBe('none');
      expect(setPlayback).not.toHaveBeenCalledWith('playing');
    });

    it('starts playing when the visitor leaves for a subpage, and stops when they come back', async () => {
      spyOnProperty(document, 'hidden').and.returnValue(false);
      await open('/');
      bringOnScreen();

      await router.navigateByUrl('/heroes');
      await fixture.whenStable();
      expect(host().hidden).toBeFalse();
      expect(setPlayback.calls.mostRecent().args).toEqual(['playing']);

      await router.navigateByUrl('/');
      await fixture.whenStable();
      expect(host().hidden).toBeTrue();
      expect(setPlayback.calls.mostRecent().args).toEqual(['paused']);
    });
  });
});
