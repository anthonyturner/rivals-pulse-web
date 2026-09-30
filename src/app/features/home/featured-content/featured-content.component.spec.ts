import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FeaturedContentComponent } from './featured-content.component';

describe('FeaturedContentComponent', () => {
  let fixture: ComponentFixture<FeaturedContentComponent>;
  let component: FeaturedContentComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeaturedContentComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FeaturedContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('starts with the Season 9 Week 2 report', () => {
    expect(component.activeSlide().id).toBe('season-9-week-2-win-rates');
    expect(component.activeSlide().actions[0].routerLink).toBe('/win-rates/9');
  });

  it('moves forward and backward through featured content', () => {
    component.showNext();
    expect(component.activeSlide().id).toBe('team-builder');

    component.showPrevious();
    expect(component.activeSlide().id).toBe('season-9-week-2-win-rates');

    component.showPrevious();
    expect(component.activeSlide().id).toBe('strategist-guides');
  });

  it('selects a slide directly', () => {
    component.showSlide(1);

    expect(component.activeIndex()).toBe(1);
    expect(component.activeSlide().id).toBe('team-builder');
  });

  it('updates the rendered feature when the next control is clicked', () => {
    const element = fixture.nativeElement as HTMLElement;
    const nextButton = element.querySelector<HTMLButtonElement>(
      '[aria-label="Show next featured item"]',
    );

    nextButton?.click();
    fixture.detectChanges();

    expect(element.querySelector('app-report-hero h3')?.textContent).toContain(
      'Build a six-player team',
    );
  });

  it('renders labelled slideshow controls', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[aria-roledescription="carousel"]')).toBeTruthy();
    expect(element.querySelector('[aria-label="Show next featured item"]')).toBeTruthy();
    expect(element.querySelectorAll('.slide-indicators button').length).toBe(
      component.slides.length,
    );
  });
});
