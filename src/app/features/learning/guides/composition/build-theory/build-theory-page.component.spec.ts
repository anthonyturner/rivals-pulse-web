import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BuildTheoryPageComponent } from './build-theory-page.component';

describe('BuildTheoryPageComponent', () => {
  let fixture: ComponentFixture<BuildTheoryPageComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(BuildTheoryPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('leaves the main landmark to the shell and has one h1 and a breadcrumb back to the guides', () => {
    const crumbs = element.querySelector('nav[aria-label="Breadcrumb"]');

    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(crumbs?.querySelector('a')?.getAttribute('href')).toBe('/hero-guides');
    expect(crumbs?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Build theory');
  });

  it('shows five build tiles with sentence-case names and decorative portraits', () => {
    const names = Array.from(element.querySelectorAll('.guide-tile-head h3'), (h3) => h3.textContent?.trim());

    expect(names).toEqual(['Utility build', 'Damage build', 'Sustain build', 'Mobility build', 'Ultimate build']);
    for (const image of Array.from(element.querySelectorAll('.guide-tile-head img'))) {
      expect(image.getAttribute('alt')).toBe('');
    }
  });

  it('labels priority and example inline, not as a definition list', () => {
    const first = element.querySelector('.guide-tile') as HTMLElement;

    expect(element.querySelector('dl')).toBeNull();
    expect(Array.from(first.querySelectorAll('strong'), (label) => label.textContent)).toEqual(['Priority:', 'Example:']);
  });

  it('keeps the signals as headed tiles and the four questions as steps', () => {
    const signalTiles = element.querySelectorAll('section.guide-section:nth-of-type(2) .guide-tile h3');

    expect(signalTiles.length).toBe(4);
    expect(element.querySelectorAll('ol.guide-steps li').length).toBe(4);
  });

  it('carries the illustration message in a callout instead of a figure', () => {
    expect(element.querySelector('app-notice')?.textContent).toContain('Utility wins by changing choices.');
    expect(element.querySelector('figure')).toBeNull();
  });
});
