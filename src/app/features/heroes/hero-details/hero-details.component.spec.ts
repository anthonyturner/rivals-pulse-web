import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import type { HeroVideoSearch } from '../hero.model';
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
  function renderFixture(
    hero: Hero = mantis,
    videos: readonly HeroVideoSearch[] = [],
  ): ComponentFixture<HeroDetailsComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const controller = TestBed.runInInjectionContext(() => new HeroesPageComponent());
    Object.defineProperty(controller, 'selectedHeroVideos', { value: () => videos });
    Object.defineProperty(controller, 'selectedHeroYoutubeUrl', {
      value: () => `https://www.youtube.com/results?search_query=${hero.name}`,
    });
    const fixture = TestBed.createComponent(HeroDetailsComponent);
    fixture.componentRef.setInput('hero', hero);
    fixture.componentRef.setInput('controller', controller);
    fixture.detectChanges();

    return fixture;
  }

  function render(hero: Hero = mantis, videos: readonly HeroVideoSearch[] = []): HTMLElement {
    return renderFixture(hero, videos).nativeElement as HTMLElement;
  }

  it('renders build signals once in its tab panel', () => {
    const element = render();

    expect(element.querySelector('.hero-build-profile h3')?.textContent?.trim()).toBe(
      'Build signals',
    );
    expect(element.querySelector('.hero-build-profile app-hero-build-signals')).not.toBeNull();
    expect(element.querySelectorAll('app-hero-build-signals').length).toBe(1);
  });

  it('drops the repeated "Overview" label under the overview heading, and makes the hero name focusable', () => {
    const element = render();

    expect(element.querySelector('.overview-panel h3')?.textContent?.trim()).toBe(
      'Fandom Overview',
    );
    expect(element.querySelector('.overview-section strong')).toBeNull();
    expect(element.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
  });

  it('shows the selected hero identity and overview before the matchup scan', () => {
    const element = render();

    expect(element.querySelector('.detail-hero-profile img')?.getAttribute('src')).toBe(
      mantis.imageUrl,
    );
    expect(element.querySelector('.detail-hero-profile img')?.getAttribute('alt')).toBe(
      mantis.name,
    );
    expect(element.querySelector('.detail-hero-lede')?.textContent?.trim()).toBe(mantis.summary);
    expect(element.querySelector('.difficulty')?.getAttribute('aria-label')).toBe(
      'Difficulty 3 out of 5',
    );
    expect(
      [...element.querySelectorAll('.community-counters, .community-stats')].map(
        (section) => section.classList[0],
      ),
    ).toEqual(['community-counters', 'community-stats']);
  });

  it('places official health and movement speed with role and difficulty in the hero profile', () => {
    const officialHero = {
      ...mantis,
      officialSource: {
        sourceUrl: 'https://marvelrivals.com/hero/mantis',
        baseStats: [
          { label: 'Health', value: '250' },
          { label: 'Movement Speed', value: '6 m/s' },
        ],
      },
    } as Hero;
    const element = render(officialHero);
    const profileCopy = element.querySelector('.detail-hero-copy');

    expect(profileCopy?.querySelector('app-eyebrow')?.textContent?.trim()).toBe('Strategist');
    expect(profileCopy?.querySelector('.difficulty')).not.toBeNull();
    expect(profileCopy?.querySelectorAll('.hero-base-stats .stat-card').length).toBe(2);
    expect(profileCopy?.querySelector('.hero-base-stats')?.textContent).toContain('Health');
    expect(profileCopy?.querySelector('.hero-base-stats')?.textContent).toContain('Movement Speed');
    expect(element.querySelectorAll('.hero-base-stats').length).toBe(1);
    expect(element.querySelector('.detail-hero-summary')).toBeNull();
    expect(element.querySelector('.hero-section-stage .hero-base-stats')).toBeNull();
  });

  it('labels the overview and source link from official hero source data', () => {
    const officialHero = {
      ...mantis,
      officialSource: { sourceUrl: 'https://marvelrivals.com/hero/mantis' },
    } as Hero;
    const element = render(officialHero);

    expect(element.querySelector('.overview-panel h3')?.textContent?.trim()).toBe(
      'Official Overview',
    );
    expect(element.querySelector('.overview-panel')?.getAttribute('aria-labelledby')).toBe(
      'hero-overview-title-mantis',
    );
    expect(element.querySelector('.overview-panel a')?.getAttribute('href')).toBe(
      officialHero.officialSource?.sourceUrl,
    );
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

  it('shows a single shared panel beneath the available hero detail tabs', () => {
    const element = render();
    const tabs = [
      ...element.querySelectorAll<HTMLButtonElement>('.hero-section-tabs [role="tab"]'),
    ];
    const stage = element.querySelector('.hero-section-stage');

    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Overview',
      'Abilities',
      'Build Signals',
      'Matchups',
      'Stats',
      'Strategy',
    ]);
    expect(stage?.parentElement?.querySelectorAll('.hero-tab-panel').length).toBe(7);
    expect(stage?.querySelectorAll('[role="tabpanel"]:not([hidden])').length).toBe(1);
    expect(stage?.querySelector('#hero-panel-overview-mantis .overview-panel')).not.toBeNull();
    expect(
      stage?.querySelector('#hero-panel-build-signals-mantis app-hero-build-signals'),
    ).not.toBeNull();
    expect(
      stage?.querySelector('#hero-panel-matchups-mantis app-hero-community-counters'),
    ).not.toBeNull();
    expect(
      stage?.querySelector('#hero-panel-stats-mantis app-hero-community-stats'),
    ).not.toBeNull();
    expect(stage?.querySelector('#hero-panel-stats-mantis app-hero-kill-feed')).not.toBeNull();
    expect(stage?.querySelector('#hero-panel-strategy-mantis')).not.toBeNull();
    expect(stage?.querySelector('#hero-panel-abilities-mantis .abilities')).not.toBeNull();
    expect(element.querySelectorAll('.hero-section-stage app-hero-community-counters').length).toBe(
      1,
    );
    expect(element.querySelectorAll('.hero-section-stage app-hero-build-signals').length).toBe(1);
    expect(element.querySelectorAll('.hero-section-stage .overview-panel').length).toBe(1);
  });

  it('switches the visible panel by click and keyboard without changing the route', () => {
    const fixture = renderFixture();
    const element = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const startingUrl = router.url;
    const buildTab = element.querySelector<HTMLButtonElement>('#hero-tab-build-signals-mantis');
    const matchupsTab = element.querySelector<HTMLButtonElement>('#hero-tab-matchups-mantis');

    buildTab?.click();
    fixture.detectChanges();

    expect(buildTab?.getAttribute('aria-selected')).toBe('true');
    expect(
      element.querySelector('#hero-panel-build-signals-mantis')?.hasAttribute('hidden'),
    ).toBeFalse();
    expect(element.querySelector('#hero-panel-overview-mantis')?.hasAttribute('hidden')).toBeTrue();
    expect(router.url).toBe(startingUrl);

    buildTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();

    expect(matchupsTab?.getAttribute('aria-selected')).toBe('true');
    expect(
      element.querySelector('#hero-panel-matchups-mantis')?.hasAttribute('hidden'),
    ).toBeFalse();

    matchupsTab?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    fixture.detectChanges();

    expect(element.querySelector('#hero-tab-overview-mantis')?.getAttribute('aria-selected')).toBe(
      'true',
        );
  });

  it('returns to Overview when a different hero is selected', () => {
    const fixture = renderFixture();
    const element = fixture.nativeElement as HTMLElement;
    const buildTab = element.querySelector<HTMLButtonElement>('#hero-tab-build-signals-mantis');

    buildTab?.click();
    fixture.detectChanges();
    fixture.componentRef.setInput('hero', { ...mantis, id: 'luna', name: 'Luna' } as Hero);
    fixture.detectChanges();

    expect(element.querySelector('#hero-tab-overview-luna')?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(element.querySelector('#hero-panel-overview-luna')?.hasAttribute('hidden')).toBeFalse();
  });

  it('adds Team-Ups only when the hero has team-up abilities', () => {
    const teamUpHero = {
      ...mantis,
      abilities: [
        { name: 'Blind Verdict', type: 'Team-Up Ability', description: 'A shared attack.' },
      ],
    } as Hero;
    const element = render(teamUpHero);
    const tab = element.querySelector<HTMLButtonElement>('#hero-tab-team-ups-mantis');

    expect(tab?.textContent?.trim()).toBe('Team-Ups');
    expect(tab?.getAttribute('aria-controls')).toBe('hero-panel-team-ups-mantis');
    expect(element.querySelector('#hero-panel-team-ups-mantis h3')?.textContent?.trim()).toBe(
      'Team-Up Abilities',
    );
  });

  it('shows the Videos tab and video component only when video content exists', () => {
    const video: HeroVideoSearch = {
      label: 'Mantis guide',
      query: 'Mantis guide',
      url: 'https://www.youtube.com/results?search_query=Mantis',
    };
    const element = render(mantis, [video]);

    expect(element.querySelector('#hero-tab-videos-mantis')?.textContent?.trim()).toBe('Videos');
    expect(element.querySelector('#hero-panel-videos-mantis app-hero-videos')).not.toBeNull();
    expect(element.querySelectorAll('.hero-section-stage app-hero-videos').length).toBe(1);
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
