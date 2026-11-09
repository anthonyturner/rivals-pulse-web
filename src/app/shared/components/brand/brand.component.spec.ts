import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BrandComponent } from './brand.component';

describe('BrandComponent', () => {
  let fixture: ComponentFixture<BrandComponent>;
  const root = document.documentElement;
  const savedTheme = root.getAttribute('data-theme');

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [BrandComponent], providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(BrandComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (savedTheme === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', savedTheme);
  });

  /** The src of each mark the current theme shows. */
  function shownMarks(): (string | null)[] {
    const marks = (fixture.nativeElement as HTMLElement).querySelectorAll('img.brand-mark');
    return Array.from(marks)
      .filter((mark) => getComputedStyle(mark).display !== 'none')
      .map((mark) => mark.getAttribute('src'));
  }

  it('shows only the dark mark in the dark theme', () => {
    root.setAttribute('data-theme', 'dark');
    expect(shownMarks()).toEqual(['/images/site/rivals-pulse-logo.svg']);
  });

  it('shows only the light mark in the light theme', () => {
    root.setAttribute('data-theme', 'light');
    expect(shownMarks()).toEqual(['/images/site/rivals-pulse-logo-light.svg']);
  });
});
