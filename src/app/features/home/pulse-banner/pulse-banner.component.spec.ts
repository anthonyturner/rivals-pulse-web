import { WritableSignal, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CircuitGrid } from '../../../core/circuit/circuit-grid';
import { THEME_STORAGE_KEY, ThemeService } from '../../../core/theme/theme.service';
import { PulseAudioService } from './pulse-audio.service';
import { PulseBannerComponent } from './pulse-banner.component';
import { COLLISION_CUE, PULSE_CUES } from './pulse-cues';
import { PulseLoopClock } from './pulse-loop-clock';
import { PulseSoundScheduler } from './pulse-sound-scheduler';

/** Stands in for the browser's audio, which needs a gesture and a speaker to run. */
class FakeAudio {
  readonly ready: WritableSignal<boolean> = signal(true);
  readonly unlockOnNextGesture = jasmine.createSpy('unlockOnNextGesture');
  readonly open = jasmine.createSpy('open').and.callFake(() => ({ now: () => 0, play: () => undefined, close: () => undefined }));
}

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

  describe('sound and picture', () => {
    function find(selector: string): Element {
      return banner().querySelector(selector) as Element;
    }

    /** Holds the animation of `selector` at `fraction` of its loop. */
    function holdAt(selector: string, fraction: number): void {
      const [animation] = find(selector).getAnimations();
      const duration = animation.effect?.getComputedTiming().duration as number;
      animation.pause();
      animation.currentTime = fraction * duration;
    }

    beforeEach(async () => {
      create();
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('runs one 2.8 second loop, which the sound reads from the animation itself', () => {
      const reading = new PulseLoopClock(() => find('.pulse-banner__spark')).read();

      expect(reading?.loopMs).toBe(2800);
      expect(reading?.positionMs).toBeGreaterThanOrEqual(0);
    });

    it('reads nothing when there is no animation to read', () => {
      expect(new PulseLoopClock(() => null).read()).toBeNull();
    });

    it('cracks when the spark flashes: the collision cue is where the picture collides', () => {
      holdAt('.pulse-banner__spark', COLLISION_CUE.at - 0.1);
      expect(Number(getComputedStyle(find('.pulse-banner__spark')).opacity)).toBeLessThan(0.05);

      holdAt('.pulse-banner__spark', COLLISION_CUE.at);
      expect(Number(getComputedStyle(find('.pulse-banner__spark')).opacity)).toBeGreaterThan(0.95);
    });

    it('thumps as each pulse passes the bumps of its spike: the heartbeat cues are where those bumps are drawn', () => {
      const spikes: [number, string, number][] = [
        [0, '.pulse-banner__window--left', 208],
        [1, '.pulse-banner__window--left', 240],
        [2, '.pulse-banner__window--right', -222],
        [3, '.pulse-banner__window--right', -256],
      ];

      for (const [index, selector, translated] of spikes) {
        holdAt(selector, PULSE_CUES[index].at);

        expect(new DOMMatrix(getComputedStyle(find(selector)).transform).m41)
          .withContext(`${PULSE_CUES[index].side} ${PULSE_CUES[index].kind}`)
          .toBeCloseTo(translated, -1);
      }
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

    function bringOnScreen(): void {
      const observer = FakeIntersectionObserver.latest;
      expect(observer).withContext('the banner watches whether it is on screen').not.toBeNull();
      observer?.report(true);
    }

    it('plays once it is on screen, and holds when the tab is hidden', async () => {
      const hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
      create();
      await fixture.whenStable();

      expect(setPlayback).not.toHaveBeenCalledWith('playing');

      bringOnScreen();

      expect(setPlayback.calls.mostRecent().args).toEqual(['playing']);

      hidden.and.returnValue(true);
      document.dispatchEvent(new Event('visibilitychange'));

      expect(setPlayback.calls.mostRecent().args).toEqual(['paused']);
      fixture.detectChanges();
      expect(banner().classList).toContain('pulse-banner--paused');
    });

    it('shows a still frame under prefers-reduced-motion, whatever is on screen', async () => {
      create(true);
      await fixture.whenStable();
      bringOnScreen();

      expect(setPlayback).toHaveBeenCalledWith('still');
      expect(setPlayback).not.toHaveBeenCalledWith('playing');
      expect(banner().classList).toContain('pulse-banner--still');
    });

    describe('sound', () => {
      let audio: FakeAudio;
      let hidden: jasmine.Spy;
      let start: jasmine.Spy;
      let stop: jasmine.Spy;

      /** Lets the banner's effects run after a change. */
      async function flush(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
      }

      async function turnSoundOn(): Promise<void> {
        fixture.componentRef.setInput('sound', true);
        await flush();
      }

      beforeEach(() => {
        audio = new FakeAudio();
        TestBed.overrideProvider(PulseAudioService, { useValue: audio });
        hidden = spyOnProperty(document, 'hidden').and.returnValue(false);
        start = spyOn(PulseSoundScheduler.prototype, 'start');
        stop = spyOn(PulseSoundScheduler.prototype, 'stop');
      });

      it('is silent until it is turned on, even while it plays', async () => {
        create();
        bringOnScreen();
        await flush();

        expect(audio.open).not.toHaveBeenCalled();
        expect(start).not.toHaveBeenCalled();
      });

      it('sounds once it is turned on and plays, and not before it is on screen', async () => {
        create();
        await turnSoundOn();
        expect(start).not.toHaveBeenCalled();

        bringOnScreen();
        await flush();

        expect(audio.open).toHaveBeenCalledTimes(1);
        expect(start).toHaveBeenCalledTimes(1);
      });

      it('stops when the tab is hidden and starts again, in step with the picture, when it is back', async () => {
        create();
        await turnSoundOn();
        bringOnScreen();
        await flush();

        hidden.and.returnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(stop).toHaveBeenCalledTimes(1);

        hidden.and.returnValue(false);
        document.dispatchEvent(new Event('visibilitychange'));
        await flush();
        expect(start).toHaveBeenCalledTimes(2);
      });

      it('stops when the banner scrolls off screen', async () => {
        create();
        await turnSoundOn();
        bringOnScreen();
        await flush();

        FakeIntersectionObserver.latest?.report(false);
        await flush();

        expect(stop).toHaveBeenCalledTimes(1);
      });

      it('stops when it is turned off, and when the banner goes', async () => {
        create();
        await turnSoundOn();
        bringOnScreen();
        await flush();

        fixture.componentRef.setInput('sound', false);
        await flush();
        expect(stop).toHaveBeenCalledTimes(1);

        await turnSoundOn();
        fixture.destroy();
        expect(stop).toHaveBeenCalledTimes(2);
      });

      it('never sounds under prefers-reduced-motion, though it is turned on', async () => {
        create(true);
        await turnSoundOn();
        bringOnScreen();
        await flush();

        expect(audio.open).not.toHaveBeenCalled();
        expect(start).not.toHaveBeenCalled();
      });

      it('waits for the browser to allow audio, then sounds', async () => {
        audio.ready.set(false);
        create();
        await turnSoundOn();
        bringOnScreen();
        await flush();

        expect(audio.unlockOnNextGesture).toHaveBeenCalled();
        expect(audio.open).not.toHaveBeenCalled();

        audio.ready.set(true);
        await flush();

        expect(start).toHaveBeenCalledTimes(1);
      });
    });

    describe('the pointer', () => {
      let setPointer: jasmine.Spy;

      /** Moves the pointer to (`x`, `y`) from the banner's top left corner. */
      function moveTo(x: number, y: number, pointerType = 'mouse'): void {
        const box = fixture.nativeElement.getBoundingClientRect();
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: box.left + x, clientY: box.top + y, pointerType }));
      }

      beforeEach(() => {
        spyOnProperty(document, 'hidden').and.returnValue(false);
        setPointer = spyOn(CircuitGrid.prototype, 'setPointer');
      });

      it('is handed to the grid, relative to the banner, while it plays', async () => {
        create();
        await fixture.whenStable();
        bringOnScreen();

        moveTo(40, 30);

        const [point] = setPointer.calls.mostRecent().args;
        expect(point.x).toBeCloseTo(40, 3);
        expect(point.y).toBeCloseTo(30, 3);
      });

      it('is taken away when it is outside the banner, or leaves the page', async () => {
        create();
        await fixture.whenStable();
        bringOnScreen();

        moveTo(40, 3000);
        expect(setPointer.calls.mostRecent().args).toEqual([null]);

        moveTo(40, 30);
        document.documentElement.dispatchEvent(new Event('pointerleave'));
        expect(setPointer.calls.mostRecent().args).toEqual([null]);
      });

      it('is not a finger dragging across the page', async () => {
        create();
        await fixture.whenStable();
        bringOnScreen();

        moveTo(40, 30, 'touch');

        expect(setPointer).not.toHaveBeenCalled();
      });

      it('is ignored while the banner is paused', async () => {
        create();
        await fixture.whenStable();

        moveTo(40, 30);

        expect(setPointer).not.toHaveBeenCalled();
      });

      it('is ignored under prefers-reduced-motion', async () => {
        create(true);
        await fixture.whenStable();
        bringOnScreen();

        moveTo(40, 30);

        expect(setPointer).not.toHaveBeenCalled();
      });
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
