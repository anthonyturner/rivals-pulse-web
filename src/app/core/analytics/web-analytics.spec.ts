import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { provideWebAnalytics, START_WEB_ANALYTICS, WEB_ANALYTICS_ENABLED } from './web-analytics';

describe('Web analytics', () => {
  let start: jasmine.Spy<() => void>;

  function boot(platform: 'browser' | 'server', enabled?: boolean): void {
    start = jasmine.createSpy('start');
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: platform },
        { provide: START_WEB_ANALYTICS, useValue: start },
        ...(enabled === undefined ? [] : [{ provide: WEB_ANALYTICS_ENABLED, useValue: enabled }]),
        provideWebAnalytics(),
      ],
    });
    TestBed.inject(WEB_ANALYTICS_ENABLED);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('starts once in the browser in a production build', () => {
    boot('browser', true);

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('never starts while rendering on the server', () => {
    boot('server', true);

    expect(start).not.toHaveBeenCalled();
  });

  it('does not start in a development build', () => {
    boot('browser', false);

    expect(start).not.toHaveBeenCalled();
  });

  it('is off by default under test, which is a development build', () => {
    boot('browser');

    expect(TestBed.inject(WEB_ANALYTICS_ENABLED)).toBeFalse();
    expect(start).not.toHaveBeenCalled();
  });
});
