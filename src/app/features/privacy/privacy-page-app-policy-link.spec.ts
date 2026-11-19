import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PrivacyPageComponent } from './privacy-page.component';

describe('PrivacyPageComponent link to the desktop app policy', () => {
  it('links to /privacy/app', async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPageComponent);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('a[href="/privacy/app"]');

    expect(link?.textContent).toContain('privacy policy');
  });
});
