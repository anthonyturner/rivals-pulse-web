import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AD_PROVIDER, AdProvider, HOUSE_AD_PROVIDER } from '../ad-slot.types';
import { ADSENSE_CONFIG, adSenseSlotId, AdSenseConfig, hasAdSenseSlot } from './adsense.config';
import { ADSENSE_AD_PROVIDER, provideAdSense } from './adsense.provider';

describe('AdSense configuration and provider', () => {
  const withSlot: AdSenseConfig = { publisherId: 'ca-pub-1', slotIds: { rectangle: ' 123 ' } };

  function providerFor(config?: AdSenseConfig): AdProvider {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ...(config ? [{ provide: ADSENSE_CONFIG, useValue: config }] : []),
        provideAdSense(),
      ],
    });
    return TestBed.inject(AD_PROVIDER);
  }

  afterEach(() => TestBed.resetTestingModule());

  it('ships with the public publisher id and no ad unit id, which keeps the house ad', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const config = TestBed.inject(ADSENSE_CONFIG);

    expect(config.publisherId).toBe('ca-pub-5750718532449576');
    expect(hasAdSenseSlot(config)).toBeFalse();
    expect(providerFor()).toBe(HOUSE_AD_PROVIDER);
  });

  it('reads an ad unit id without its surrounding spaces, and treats a blank one as unset', () => {
    expect(adSenseSlotId(withSlot, 'rectangle')).toBe('123');
    expect(adSenseSlotId(withSlot, 'halfPage')).toBeNull();
    expect(adSenseSlotId({ publisherId: 'ca-pub-1', slotIds: { rectangle: '  ' } }, 'rectangle')).toBeNull();
  });

  it('becomes the ad provider once an ad unit id is set, and renders only in the browser', () => {
    expect(providerFor(withSlot)).toBe(ADSENSE_AD_PROVIDER);
    expect(ADSENSE_AD_PROVIDER.browserOnly).toBeTrue();
  });
});
