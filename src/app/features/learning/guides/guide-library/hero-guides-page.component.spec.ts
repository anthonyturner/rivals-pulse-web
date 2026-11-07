import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroGuidesPageComponent } from './hero-guides-page.component';

describe('HeroGuidesPageComponent', () => {
  let element: HTMLElement;

  const links = () => Array.from(element.querySelectorAll('app-guide-card a'));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HeroGuidesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('is titled Guides, with the groups as headings under it', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Guides');
    expect(Array.from(element.querySelectorAll('h2'), (heading) => heading.textContent?.trim())).toEqual([
      'Start here',
      'Hero guides',
      'Fundamentals',
      'Habits and team play',
      'Strategist lessons',
    ]);
  });

  it('gives every guide link its own name', () => {
    const names = links().map((link) => link.textContent?.trim());

    expect(names.length).toBe(27);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists the tempo and ultimate economy guide under its own address', () => {
    expect(links().map((link) => link.getAttribute('href'))).toContain('/hero-guides/tempo-and-ultimate-economy');
  });

  it('links the strategist lessons', () => {
    expect(links().map((link) => link.getAttribute('href'))).toContain('/strategist-guides');
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});
