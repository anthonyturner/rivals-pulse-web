import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroPageHeaderComponent } from './hero-page-header.component';

describe('HeroPageHeaderComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture: ComponentFixture<HeroPageHeaderComponent> = TestBed.createComponent(HeroPageHeaderComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('is a plain page title with one line of lede', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Heroes');
    expect(element.querySelector('.lede')?.textContent?.trim()).toBe(
      'Compare roles, counters, abilities and guides.',
    );
  });

  it('carries no eyebrow, banner image or visible-count box', () => {
    expect(element.querySelector('app-eyebrow')).toBeNull();
    expect(element.querySelector('.header-stat')).toBeNull();
    expect(element.textContent).not.toContain('Â');
  });
});
