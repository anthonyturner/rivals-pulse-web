import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Hero } from '../hero.model';
import { HeroesPageComponent } from '../heroes-page.component';
import { HeroDetailsComponent } from './hero-details.component';

const mantis = {
  id: 'mantis',
  name: 'Mantis',
  role: 'Strategist',
  difficulty: 3,
  summary: 'Heals and buffs.',
  playstyle: '',
  strengths: [],
  weaknesses: [],
  counters: [],
  synergies: [],
  abilities: [],
  imageUrl: '/images/heroes/mantis.png',
} as Hero;

describe('HeroDetailsComponent', () => {
  function render(compact?: boolean): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const controller = TestBed.runInInjectionContext(() => new HeroesPageComponent());
    const fixture = TestBed.createComponent(HeroDetailsComponent);
    fixture.componentRef.setInput('hero', mantis);
    fixture.componentRef.setInput('controller', controller);
    if (compact !== undefined) {
      fixture.componentRef.setInput('compact', compact);
    }
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it('starts the long sections collapsed in the compact panel', () => {
    const sections = Array.from(render(true).querySelectorAll<HTMLDetailsElement>('details.collapsible'));

    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some((section) => section.open)).toBeFalse();
    expect(sections.map((section) => section.querySelector('summary h3')?.textContent?.trim())).toContain('Build Profile');
  });

  it('renders the profile window as plain sections: no collapsible details, subtitle inside the heading, "Overview" label kept', () => {
    const element = render();

    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelector('section.hero-build-profile > .section-heading > p')?.textContent?.trim()).toBe(
      '0-10 coach rating by fight-plan value, not official stats',
    );
    expect(element.querySelector('.section-note')).toBeNull();
    expect(element.querySelector('.overview-section strong')?.textContent?.trim()).toBe('Overview');
    expect(element.querySelector('.detail-hero-container--compact')).toBeNull();
  });

  it('drops the repeated "Overview" label under the overview heading in the compact panel, and makes the hero name focusable', () => {
    const element = render(true);

    expect(element.querySelector('.overview-panel h3')?.textContent?.trim()).toBe('Fandom Overview');
    expect(element.querySelector('.overview-section strong')).toBeNull();
    expect(element.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
  });

  it("puts the hero's role above the name, and nowhere else", () => {
    const element = render();

    const heading = element.querySelector('h2') as HTMLElement;
    const eyebrow = element.querySelector('app-eyebrow') as HTMLElement;

    expect(eyebrow.textContent?.trim()).toBe('Strategist');
    expect(eyebrow.nextElementSibling).toBe(heading);
    expect(heading.textContent?.trim()).toBe('Mantis');
    expect(element.querySelectorAll('.detail-hero-media app-eyebrow').length).toBe(1);
    expect(element.querySelector('.hero-role')).toBeNull();
  });
});
