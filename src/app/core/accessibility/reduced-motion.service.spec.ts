import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReducedMotionService } from './reduced-motion.service';

describe('ReducedMotionService', () => {
  let matches: boolean;
  let onChange: (() => void) | null;

  beforeEach(() => {
    matches = false;
    onChange = null;
    spyOn(window, 'matchMedia').and.callFake(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_type: string, listener: () => void) => (onChange = listener),
          removeEventListener: () => (onChange = null),
        }) as unknown as MediaQueryList,
    );
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  async function firstRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('is false until the first render, even when the device asks for less motion', () => {
    matches = true;

    expect(TestBed.inject(ReducedMotionService).reduced()).toBeFalse();
  });

  it('reads the device setting after the first render', async () => {
    matches = true;
    const service = TestBed.inject(ReducedMotionService);
    await firstRender();

    expect(service.reduced()).toBeTrue();
  });

  it('follows the setting when it changes while the page is open', async () => {
    const service = TestBed.inject(ReducedMotionService);
    await firstRender();
    expect(service.reduced()).toBeFalse();

    matches = true;
    onChange?.();

    expect(service.reduced()).toBeTrue();
  });
});
