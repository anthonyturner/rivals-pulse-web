import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AffiliateDisclosureComponent } from './affiliate-disclosure.component';

describe('AffiliateDisclosureComponent', () => {
  it('says affiliate links earn a commission and cost the reader nothing extra', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(AffiliateDisclosureComponent);
    fixture.detectChanges();

    const text = ((fixture.nativeElement as HTMLElement).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('affiliate links');
    expect(text).toContain('RivalsPulse may earn a commission');
    expect(text).toContain('at no extra cost to you');
  });
});
