import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AD_SLOT_SIZES } from '../ad-slot.types';
import { HouseAdComponent } from './house-ad.component';

describe('HouseAdComponent', () => {
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HouseAdComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    const fixture: ComponentFixture<HouseAdComponent> = TestBed.createComponent(HouseAdComponent);
    fixture.componentRef.setInput('slotId', 'rectangle');
    fixture.componentRef.setInput('size', AD_SLOT_SIZES.rectangle);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  it('promotes the app without a coming-soon button, since there is no store listing yet', () => {
    expect(page.querySelector('.house-ad__title')?.textContent).toContain('RivalsPulse');
    expect(page.textContent).not.toMatch(/coming soon/i);
  });

  it('adds no heading to the pages it sits beside', () => {
    expect(page.querySelector('h1, h2, h3, h4, h5, h6')).toBeNull();
  });

  it('links nowhere, because the overlay has no store listing yet', () => {
    expect(page.querySelector('a')).toBeNull();
    expect(page.querySelector('[href]')).toBeNull();
  });

  it('uses no Marvel or NetEase branding', () => {
    expect(page.textContent).not.toMatch(/marvel|netease/i);
    expect(page.querySelector('img, svg, picture')).toBeNull();
  });
});
