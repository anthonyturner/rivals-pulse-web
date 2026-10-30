import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Footer } from './footer';

describe('Footer', () => {
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  it('links to the privacy notes', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      'a[href="/privacy"]',
    ) as HTMLAnchorElement | null;

    expect(link).withContext('the footer has a privacy link').toBeTruthy();
    expect(link?.textContent?.trim()).toBe('Privacy notes');
  });
});
