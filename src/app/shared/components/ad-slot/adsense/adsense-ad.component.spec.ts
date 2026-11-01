import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { GoogleConsentService } from '../../../../core/consent/google-consent.service';
import type { ConsentStatus } from '../../../../core/consent/tcf-consent';
import { AD_SLOT_SIZES } from '../ad-slot.types';
import { AdSenseAdComponent } from './adsense-ad.component';
import { ADSENSE_CONFIG, AdSenseConfig } from './adsense.config';

@Component({ template: '' })
class PageComponent {}

@Component({
  selector: 'app-test-host',
  imports: [AdSenseAdComponent],
  template: `<app-adsense-ad slotId="rectangle" [size]="size" />`,
})
class HostComponent {
  readonly size = AD_SLOT_SIZES.rectangle;
}

const configured: AdSenseConfig = { publisherId: 'ca-pub-1', slotIds: { rectangle: '1234567890' } };

describe('AdSenseAdComponent', () => {
  let consent: ReturnType<typeof signal<ConsentStatus>>;
  let push: jasmine.Spy;

  async function render(config: AdSenseConfig = configured): Promise<ComponentFixture<HostComponent>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'heroes', component: PageComponent },
          { path: 'tier-list', component: PageComponent },
          { path: 'community', component: PageComponent },
        ]),
        { provide: ADSENSE_CONFIG, useValue: config },
        { provide: GoogleConsentService, useValue: { status: consent } },
      ],
    });

    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    return fixture;
  }

  const units = (fixture: ComponentFixture<HostComponent>): HTMLElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('ins.adsbygoogle'));

  const houseAd = (fixture: ComponentFixture<HostComponent>): Element | null =>
    (fixture.nativeElement as HTMLElement).querySelector('app-house-ad');

  async function navigate(fixture: ComponentFixture<HostComponent>, url: string): Promise<void> {
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
  }

  beforeEach(() => {
    consent = signal<ConsentStatus>('granted');
    push = jasmine.createSpy('adsbygoogle.push');
    Reflect.set(window, 'adsbygoogle', { push });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    Reflect.deleteProperty(window, 'adsbygoogle');
  });

  it('shows the house ad and asks Google for nothing while the ad unit id is unset', async () => {
    const unset: AdSenseConfig[] = [
      { publisherId: 'ca-pub-1', slotIds: { rectangle: '' } },
      { publisherId: 'ca-pub-1', slotIds: {} },
    ];

    for (const config of unset) {
      const fixture = await render(config);

      expect(units(fixture).length).toBe(0);
      expect(houseAd(fixture)).not.toBeNull();
    }
    expect(push).not.toHaveBeenCalled();
  });

  it('shows the house ad and asks Google for nothing until the visitor has agreed', async () => {
    for (const status of ['pending', 'declined'] as const) {
      consent.set(status);
      const fixture = await render();

      expect(units(fixture).length).withContext(status).toBe(0);
      expect(houseAd(fixture)).withContext(status).not.toBeNull();
    }
    expect(push).not.toHaveBeenCalled();
  });

  it('creates one sized ad unit and requests an ad for it once the visitor has agreed', async () => {
    const fixture = await render();
    const [unit] = units(fixture);

    expect(units(fixture).length).toBe(1);
    expect(houseAd(fixture)).toBeNull();
    expect(unit.getAttribute('data-ad-client')).toBe('ca-pub-1');
    expect(unit.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(unit.style.width).toBe('300px');
    expect(unit.style.height).toBe('250px');
    expect(push).toHaveBeenCalledOnceWith({});
  });

  it('swaps between the ad and the house ad as the visitor changes their choice', async () => {
    consent.set('pending');
    const fixture = await render();
    expect(units(fixture).length).toBe(0);

    consent.set('granted');
    await fixture.whenStable();
    expect(units(fixture).length).toBe(1);
    expect(push).toHaveBeenCalledTimes(1);

    consent.set('declined');
    await fixture.whenStable();
    expect(units(fixture).length).toBe(0);
    expect(houseAd(fixture)).not.toBeNull();
  });

  it('requests a new ad on each page, with one unit on screen and none left over', async () => {
    const fixture = await render();
    const seen = [units(fixture)[0]];

    for (const [index, url] of ['/heroes', '/tier-list', '/community'].entries()) {
      await navigate(fixture, url);

      expect(units(fixture).length).withContext(url).toBe(1);
      expect(seen.includes(units(fixture)[0])).withContext(`a new unit on ${url}`).toBeFalse();
      expect(push).toHaveBeenCalledTimes(index + 2);
      seen.push(units(fixture)[0]);
    }
  });

  it('keeps the same ad when only the query or the section of the page changes', async () => {
    const fixture = await render();
    await navigate(fixture, '/heroes');
    const unit = units(fixture)[0];
    push.calls.reset();

    await navigate(fixture, '/heroes?role=tank');
    await navigate(fixture, '/heroes?role=tank#details');

    expect(units(fixture).length).toBe(1);
    expect(units(fixture)[0]).toBe(unit);
    expect(push).not.toHaveBeenCalled();
  });
});
