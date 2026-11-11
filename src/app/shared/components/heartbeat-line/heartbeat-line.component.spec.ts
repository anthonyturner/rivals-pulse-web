import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeartbeatLine } from '../../../core/circuit/heartbeat-line';
import { HeartbeatLineComponent } from './heartbeat-line.component';

/** Stands in for the browser's observer, so a spec says when the line is on screen. */
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

describe('HeartbeatLineComponent', () => {
  let fixture: ComponentFixture<HeartbeatLineComponent>;
  let setPlayback: jasmine.Spy;
  const realIntersectionObserver = window.IntersectionObserver;

  const lastPlayback = (): unknown => setPlayback.calls.mostRecent().args[0];

  async function render(reducedMotion = false): Promise<void> {
    const real = window.matchMedia.bind(window);
    spyOn(window, 'matchMedia').and.callFake((query) =>
      query === '(prefers-reduced-motion: reduce)'
        ? ({ matches: reducedMotion, addEventListener: () => undefined, removeEventListener: () => undefined } as unknown as MediaQueryList)
        : real(query),
    );
    fixture = TestBed.createComponent(HeartbeatLineComponent);
    await fixture.whenStable();
  }

  beforeEach(() => {
    FakeIntersectionObserver.latest = null;
    window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
    setPlayback = spyOn(HeartbeatLine.prototype, 'setPlayback');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => {
    window.IntersectionObserver = realIntersectionObserver;
  });

  it('is decoration: hidden from assistive technology, holding no text and taking no click or layout space', async () => {
    await render();

    const host = fixture.nativeElement as HTMLElement;
    const style = getComputedStyle(host);

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.textContent?.trim()).toBe('');
    expect(host.querySelector('canvas')).not.toBeNull();
    expect(style.pointerEvents).toBe('none');
    expect(style.position).toBe('absolute');
  });

  it('does not animate while it is off screen', async () => {
    await render();

    expect(lastPlayback()).toBe('paused');
  });

  it('plays once it is on screen, and pauses when it leaves', async () => {
    await render();

    FakeIntersectionObserver.latest?.report(true);
    expect(lastPlayback()).toBe('playing');

    FakeIntersectionObserver.latest?.report(false);
    expect(lastPlayback()).toBe('paused');
  });

  it('holds one still frame and never plays when the visitor asks for less motion', async () => {
    await render(true);

    FakeIntersectionObserver.latest?.report(true);

    expect(lastPlayback()).toBe('still');
    expect(setPlayback).not.toHaveBeenCalledWith('playing');
  });

  it('pauses while the tab is hidden, and plays again when it is shown', async () => {
    await render();
    FakeIntersectionObserver.latest?.report(true);
    const hidden = spyOnProperty(document, 'hidden');

    hidden.and.returnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(lastPlayback()).toBe('paused');

    hidden.and.returnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(lastPlayback()).toBe('playing');
  });

  it('takes the beat rate it is given', async () => {
    const setRate = spyOn(HeartbeatLine.prototype, 'setRate');
    await render();

    fixture.componentRef.setInput('rate', 60);
    await fixture.whenStable();

    expect(setRate).toHaveBeenCalledWith(60);
  });
});
