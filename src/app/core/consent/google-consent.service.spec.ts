import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  CONSENT_LATE_POLL_MS,
  CONSENT_WAIT_MS,
  CONSENT_WATCH_MS,
  GoogleConsentService,
} from './google-consent.service';

type TcfCallback = (data: unknown, success: boolean) => void;

describe('GoogleConsentService', () => {
  let listener: TcfCallback | undefined;
  let tcfApi: jasmine.Spy;

  const granted = {
    cmpStatus: 'loaded',
    gdprApplies: true,
    eventStatus: 'useractioncomplete',
    purpose: { consents: { '1': true } },
    vendor: { consents: { '755': true } },
  };

  function installTcfApi(): void {
    tcfApi = jasmine.createSpy('__tcfapi').and.callFake((command: string, _version: number, callback: TcfCallback) => {
      if (command === 'addEventListener') {
        listener = callback;
      }
    });
    Reflect.set(window, '__tcfapi', tcfApi);
  }

  function create(): GoogleConsentService {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    return TestBed.inject(GoogleConsentService);
  }

  beforeEach(() => {
    jasmine.clock().install();
    listener = undefined;
  });

  afterEach(() => {
    jasmine.clock().uninstall();
    Reflect.deleteProperty(window, '__tcfapi');
    Reflect.deleteProperty(window, 'googlefc');
  });

  it('is pending until Google answers', () => {
    installTcfApi();
    const consent = create();

    expect(consent.status()).toBe('pending');
    expect(tcfApi).toHaveBeenCalledWith('addEventListener', 2, jasmine.any(Function));
  });

  it('follows the visitor from the open message to their choice, and back when they change it', () => {
    installTcfApi();
    const consent = create();

    listener?.({ ...granted, eventStatus: 'cmpuishown' }, true);
    expect(consent.status()).toBe('pending');

    listener?.(granted, true);
    expect(consent.status()).toBe('granted');
    expect(consent.canChangeChoice()).toBeTrue();

    listener?.({ ...granted, purpose: { consents: {} } }, true);
    expect(consent.status()).toBe('declined');
  });

  it('finds the consent API when Google adds it a moment after the page loads', () => {
    const consent = create();
    jasmine.clock().tick(500);
    expect(consent.status()).toBe('pending');

    installTcfApi();
    jasmine.clock().tick(100);
    listener?.(granted, true);

    expect(consent.status()).toBe('granted');
  });

  it('treats a visitor with no consent message as not needing one, once it is clear none is coming', () => {
    const consent = create();

    jasmine.clock().tick(CONSENT_WAIT_MS - 100);
    expect(consent.status()).toBe('pending');

    jasmine.clock().tick(100);
    expect(consent.status()).toBe('granted');
    expect(consent.canChangeChoice()).toBeFalse();
  });

  it('reads a consent message that arrives after the wait, and a decline then brings the house ad back', () => {
    const consent = create();
    jasmine.clock().tick(CONSENT_WAIT_MS);
    expect(consent.status()).toBe('granted');
    expect(consent.canChangeChoice()).toBeFalse();

    installTcfApi();
    jasmine.clock().tick(CONSENT_LATE_POLL_MS);
    listener?.({ ...granted, purpose: { consents: {} }, vendor: { consents: {} } }, true);

    expect(consent.status()).toBe('declined');
    expect(consent.canChangeChoice()).toBeTrue();
  });

  it('takes the ad away again if a late message shows it has not been answered yet', () => {
    const consent = create();
    jasmine.clock().tick(CONSENT_WAIT_MS);

    installTcfApi();
    jasmine.clock().tick(CONSENT_LATE_POLL_MS);
    listener?.({ ...granted, eventStatus: 'cmpuishown' }, true);

    expect(consent.status()).toBe('pending');
  });

  it('stops looking once the consent script has had far longer than any load should take', () => {
    create();
    jasmine.clock().tick(CONSENT_WATCH_MS + CONSENT_LATE_POLL_MS);

    installTcfApi();
    jasmine.clock().tick(CONSENT_WATCH_MS);

    expect(tcfApi).not.toHaveBeenCalled();
  });

  it('declines when the consent API fails', () => {
    spyOn(console, 'error');
    Reflect.set(window, '__tcfapi', () => {
      throw new Error('broken');
    });

    expect(create().status()).toBe('declined');
  });

  it('queues the revocation message Google documents when asked to reopen the choice', () => {
    installTcfApi();
    const showRevocationMessage = (): void => undefined;
    const callbackQueue: unknown[] = [];
    Reflect.set(window, 'googlefc', { callbackQueue, showRevocationMessage });

    create().reopenChoices();

    expect(callbackQueue).toEqual([showRevocationMessage]);
  });

  it('does nothing when asked to reopen before Google has loaded', () => {
    expect(() => create().reopenChoices()).not.toThrow();
  });
});
