import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FirstTimeGuidePageComponent } from './first-time-guide-page.component';

describe('FirstTimeGuidePageComponent', () => {
  let fixture: ComponentFixture<FirstTimeGuidePageComponent>;
  let component: FirstTimeGuidePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstTimeGuidePageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FirstTimeGuidePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a full first time guide outline', () => {
    expect(component.sections.length).toBeGreaterThan(5);
    expect(component.quickRules).toContain('Fight with teammates.');
  });

  it('points the lede links at released pages only', () => {
    const element = fixture.nativeElement as HTMLElement;
    const targets = Array.from(element.querySelectorAll('.guide-header p a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(targets).toEqual(['/beginner-interactive-guide', '/media-tutorials']);
  });

  it('is one article with a breadcrumb, one main and a decorative portrait', () => {
    const element = fixture.nativeElement as HTMLElement;
    const crumbs = element.querySelector('nav[aria-label="Breadcrumb"]');

    expect(element.querySelectorAll('main').length).toBe(1);
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(crumbs?.querySelector('a')?.getAttribute('href')).toBe('/hero-guides');
    expect(crumbs?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('First-time guide');
    expect(element.querySelector('img.guide-portrait')?.getAttribute('alt')).toBe('');
  });

  it('lists the five rules as steps and every section flat, with the first match plan as steps', () => {
    const element = fixture.nativeElement as HTMLElement;
    const rules = element.querySelectorAll('.guide-tile ol.guide-steps li');
    const sections = element.querySelectorAll('section.guide-section');

    expect(rules.length).toBe(component.quickRules.length);
    expect(sections.length).toBe(component.sections.length);
    expect(element.querySelectorAll('section.guide-section ul.guide-bullets').length).toBe(sections.length - 1);
    expect(element.querySelectorAll('section.guide-section ol.guide-steps').length).toBe(1);
    expect(element.querySelector('section.guide-section:has(ol.guide-steps) h2')?.textContent).toBe('Your first match plan');
  });
});
