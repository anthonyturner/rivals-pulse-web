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
    fixture.componentRef.setInput('slot', AD_SLOT_SIZES.rectangle);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
  });

  it('promotes the overlay and says it is coming soon', () => {
    expect(page.querySelector('h2')?.textContent).toContain('Rivals Pulse overlay');
    expect(page.textContent).toContain('Coming soon');
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
