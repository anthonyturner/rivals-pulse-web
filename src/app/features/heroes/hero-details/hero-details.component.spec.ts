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

  it('renders build signals once in the quick guide', () => {
    const element = render();

    expect(element.querySelector('.hero-build-profile h3')?.textContent?.trim()).toBe('Build signals');
    expect(element.querySelector('.hero-build-profile app-hero-build-signals')).not.toBeNull();
    expect(element.querySelectorAll('app-hero-build-signals').length).toBe(1);
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
    expect(element.querySelector('.overview-panel')?.getAttribute('aria-labelledby')).toBe(
      'hero-overview-title-mantis',
    );
    expect(element.querySelector('.overview-panel a')?.getAttribute('href')).toBe(officialHero.officialSource?.sourceUrl);
  });

  it('shows role, matching archetype, and difficulty as data-backed profile tags', () => {
    const taggedHero = {
      ...mantis,
      gameplayArchetypes: [
        {
          role: 'Strategist',
          label: 'Tempo setter',
          description: 'Controls the pace of a fight.',
          sourceTitle: 'Guide',
          sourceUrl: 'https://example.com/guide',
          timestamp: '1:00',
        },
        {
          role: 'Duelist',
          label: 'Flanker',
          description: 'Attacks from the side.',
          sourceTitle: 'Guide',
          sourceUrl: 'https://example.com/guide',
          timestamp: '2:00',
        },
      ],
    } as Hero;
    const element = render(taggedHero);
    const tags = element.querySelector('.detail-hero-tags')?.textContent ?? '';

    expect(tags).toContain('Strategist');
    expect(tags).toContain('Tempo setter');
    expect(tags).toContain('Difficulty 3/5');
    expect(tags).not.toContain('Flanker');
  });

  it('connects jump links to the three guide cards and available hero sections', () => {
    const element = render();
    const navigation = element.querySelector('.hero-jump-nav');
    const links = [...(navigation?.querySelectorAll<HTMLAnchorElement>('a') ?? [])];
    const localLinks = links.filter((link) => !link.textContent?.includes('Videos'));
    const cardIds = [...element.querySelectorAll('.hero-guide-grid > [id]')].map((card) => card.id);

    expect(localLinks.map((link) => link.textContent?.trim())).toEqual([
      'Overview',
      'Abilities',
      'Build signals',
      'Matchups',
    ]);
    expect(
      localLinks.every((link) => {
        const href = link.getAttribute('href') ?? '';
        const fragment = new URL(href, document.baseURI).hash;

        return (
          link.getAttribute('routerlink') === '.' &&
          link.getAttribute('queryparamshandling') === 'preserve' &&
          fragment !== '' &&
          element.querySelector(fragment) !== null
        );
      }),
    ).toBeTrue();
    expect(cardIds).toEqual(['hero-matchups-mantis', 'hero-build-signals-mantis', 'hero-overview-mantis']);
    expect(element.querySelectorAll('.hero-guide-grid app-hero-community-counters').length).toBe(1);
    expect(element.querySelectorAll('.hero-guide-grid app-hero-build-signals').length).toBe(1);
    expect(element.querySelectorAll('.hero-guide-grid .overview-panel').length).toBe(1);
  });

  it('adds the team-up jump link only when the hero has a team-up section', () => {
    const teamUpHero = {
      ...mantis,
      abilities: [{ name: 'Blind Verdict', type: 'Team-Up Ability', description: 'A shared attack.' }],
    } as Hero;
    const element = render(teamUpHero);
    const link = [...element.querySelectorAll<HTMLAnchorElement>('.hero-jump-nav a')].find(
      (candidate) => candidate.textContent?.trim() === 'Team-ups',
    );

    expect(link?.getAttribute('routerlink')).toBe('.');
    expect(new URL(link?.getAttribute('href') ?? '', document.baseURI).hash).toBe('#hero-team-ups-mantis');
    expect(element.querySelector('#hero-team-ups-mantis h3')?.textContent?.trim()).toBe('Team-Up Abilities');
  });

  it('shows guide cards in one row when wide and stacks them when narrow', () => {
    const element = render();
    element.style.width = '1000px';
    const getCards = (): DOMRect[] =>
      [...element.querySelectorAll<HTMLElement>('.hero-guide-grid > [id]')].map((card) => card.getBoundingClientRect());
    const wideCards = getCards();

    expect(wideCards[1].left).toBeGreaterThan(wideCards[0].left);
    expect(wideCards[1].top).toBe(wideCards[0].top);
    expect(wideCards[2].left).toBeGreaterThan(wideCards[1].left);

    element.style.width = '520px';
    const narrowCards = getCards();

    expect(narrowCards[1].left).toBe(narrowCards[0].left);
    expect(narrowCards[2].left).toBe(narrowCards[0].left);
    expect(narrowCards[1].top).toBeGreaterThanOrEqual(narrowCards[0].bottom);
    expect(narrowCards[2].top).toBeGreaterThanOrEqual(narrowCards[1].bottom);
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
