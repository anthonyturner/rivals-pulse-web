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
  function render(hero: Hero = mantis): HTMLElement {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const controller = TestBed.runInInjectionContext(() => new HeroesPageComponent());
    const fixture = TestBed.createComponent(HeroDetailsComponent);
    fixture.componentRef.setInput('hero', hero);
    fixture.componentRef.setInput('controller', controller);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it('starts the long sections collapsed', () => {
    const sections = Array.from(render().querySelectorAll<HTMLDetailsElement>('details.collapsible'));

    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some((section) => section.open)).toBeFalse();
    expect(sections.map((section) => section.querySelector('summary h3')?.textContent?.trim())).toContain('Build Signals');
    expect(sections[0].querySelector('.collapsible-body > .section-note')?.textContent?.trim()).toBe(
      "Scores out of 10. Mobility comes from the hero's kit, the rest from matches recorded by RivalsPulse players",
    );
  });

  it('drops the repeated "Overview" label under the overview heading, and makes the hero name focusable', () => {
    const element = render();

    expect(element.querySelector('.overview-panel h3')?.textContent?.trim()).toBe('Fandom Overview');
    expect(element.querySelector('.overview-section strong')).toBeNull();
    expect(element.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows the selected hero identity and overview before the matchup scan', () => {
    const element = render();

    expect(element.querySelector('.detail-hero-profile img')?.getAttribute('src')).toBe(mantis.imageUrl);
    expect(element.querySelector('.detail-hero-profile img')?.getAttribute('alt')).toBe(mantis.name);
    expect(element.querySelector('.detail-hero-lede')?.textContent?.trim()).toBe(mantis.summary);
    expect(element.querySelector('.difficulty')?.getAttribute('aria-label')).toBe('Difficulty 3 out of 5');
    expect([...element.querySelectorAll('.community-counters, .community-stats')].map((section) => section.classList[0]))
      .toEqual(['community-counters', 'community-stats']);
  });

  it('labels the overview and source link from official hero source data', () => {
    const officialHero = {
      ...mantis,
      officialSource: { sourceUrl: 'https://marvelrivals.com/hero/mantis' },
    } as Hero;
    const element = render(officialHero);

    expect(element.querySelector('.overview-panel h3')?.textContent?.trim()).toBe('Official Overview');
    expect(element.querySelector('.overview-panel')?.getAttribute('aria-label')).toBe('Marvel Rivals official overview');
    expect(element.querySelector('.overview-panel a')?.getAttribute('href')).toBe(officialHero.officialSource?.sourceUrl);
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
