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
      'Team fit',
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

    expect(element.querySelector('.poster-portrait')?.getAttribute('src')).toBe(mantis.imageUrl);
    expect(element.querySelector('.poster-portrait')?.getAttribute('alt')).toBe(mantis.name);
    expect(element.querySelector('.poster-summary')?.textContent?.trim()).toBe(mantis.summary);
    expect(
      [...element.querySelectorAll('.community-counters, .community-stats')].map(
        (section) => section.classList[0],
      ),
    ).toEqual(['community-counters', 'community-stats']);
  });

  it('lists the official base stats and the difficulty in one stat bar', () => {
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
    const cells = [...element.querySelectorAll('.poster-stats .poster-stat')];

    expect(cells.map((cell) => cell.querySelector('dt')?.textContent?.trim())).toEqual([
      'Health',
      'Movement Speed',
      'Difficulty',
    ]);
    expect(cells[0].querySelector('dd')?.textContent?.trim()).toBe('250');
    expect(element.querySelectorAll('.poster-stats').length).toBe(1);
    expect(element.querySelector('.hero-section-stage .poster-stats')).toBeNull();
  });

  it('shows the difficulty as a number, five pips and an accessible label', () => {
    const element = render();
    const meter = element.querySelector('.poster-difficulty .poster-meter') as HTMLElement;

    expect(element.querySelector('.poster-difficulty dt')?.textContent?.trim()).toBe('Difficulty');
    expect(meter.getAttribute('aria-label')).toBe('Difficulty 3 out of 5');
    expect(meter.textContent?.replace(/\s+/g, ' ').trim()).toBe('3 / 5');
    expect(meter.querySelectorAll('.poster-pips span').length).toBe(5);
    expect(meter.querySelectorAll('.poster-pips span.filled').length).toBe(3);
    expect(meter.querySelector('.poster-pips')?.getAttribute('aria-hidden')).toBe('true');
  });

  it("draws the hero's art behind the header as decoration only", () => {
    const element = render();
    const art = element.querySelector('.poster-art') as HTMLElement;
    const image = art.querySelector('img') as HTMLImageElement;

    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(image.getAttribute('src')).toBe(mantis.imageUrl);
    expect(image.getAttribute('alt')).toBe('');
    expect(element.querySelectorAll('img[alt="Mantis"]').length).toBe(1);
  });

  it('sets the role colour hook from the hero role', () => {
    const roleClass = (role: Hero['role']): string[] => {
      TestBed.resetTestingModule();
      const poster = render({ ...mantis, role }).querySelector('.hero-poster') as HTMLElement;

      return [...poster.classList].filter((name) => name.startsWith('role-'));
    };

    expect(roleClass('Vanguard')).toEqual(['role-vanguard']);
    expect(roleClass('Duelist')).toEqual(['role-duelist']);
    expect(roleClass('Strategist')).toEqual(['role-strategist']);
    expect(roleClass('Multi-Role')).toEqual(['role-multi-role']);
  });

  it('shows only the difficulty cell for a hero with no official stats', () => {
    const element = render();
    const cells = [...element.querySelectorAll('.poster-stats .poster-stat')];

    expect(cells.length).toBe(1);
    expect(cells[0].querySelector('dt')?.textContent?.trim()).toBe('Difficulty');
  });

  it('follows the selected ability kit when the banner stats depend on the role', async () => {
    const kitHero = {
      ...mantis,
      roleAbilityKits: [
        { role: 'Vanguard', label: 'Vanguard kit', abilities: [] },
        { role: 'Duelist', label: 'Duelist kit', abilities: [] },
      ],
      officialSource: {
        sourceUrl: 'https://marvelrivals.com/hero/mantis',
        baseStatKits: [
          { role: 'Vanguard', label: 'Vanguard', stats: [{ label: 'Health', value: '650' }] },
          { role: 'Duelist', label: 'Duelist', stats: [{ label: 'Health', value: '250' }] },
        ],
      },
    } as Hero;
    const fixture = renderFixture(kitHero);
    const element = fixture.nativeElement as HTMLElement;
    const health = (): string | undefined =>
      element.querySelector('.poster-stats .poster-stat dd')?.textContent?.trim();

    expect(health()).toBe('650');

    const controller = fixture.componentInstance.controller;
    controller.selectAbilityKit('Duelist');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(health()).toBe('250');
  });

  it('moves the banner role label, colour and stats together when the kit changes on a multi-role hero', async () => {
    const multiRoleHero = {
      ...mantis,
      name: 'Deadpool',
      role: 'Multi-Role',
      roleAbilityKits: [
        { role: 'Vanguard', label: 'Vanguard kit', abilities: [] },
        { role: 'Duelist', label: 'Duelist kit', abilities: [] },
        { role: 'Strategist', label: 'Strategist kit', abilities: [] },
      ],
      officialSource: {
        sourceUrl: 'https://marvelrivals.com/hero/deadpool',
        baseStatKits: [
          { role: 'Vanguard', label: 'Vanguard', stats: [{ label: 'Health', value: '650' }] },
          { role: 'Duelist', label: 'Duelist', stats: [{ label: 'Health', value: '250' }] },
          { role: 'Strategist', label: 'Strategist', stats: [{ label: 'Health', value: '300' }] },
        ],
      },
    } as Hero;
    const fixture = renderFixture(multiRoleHero);
    const element = fixture.nativeElement as HTMLElement;
    const controller = fixture.componentInstance.controller;
    const banner = (): { kicker?: string; roleClasses: string[]; health?: string } => {
      const poster = element.querySelector('.hero-poster') as HTMLElement;

      return {
        kicker: element.querySelector('.poster-kicker')?.textContent?.trim(),
        roleClasses: [...poster.classList].filter((name) => name.startsWith('role-')),
        health: element.querySelector('.poster-stats .poster-stat dd')?.textContent?.trim(),
      };
    };

    expect(banner()).toEqual({ kicker: 'Vanguard', roleClasses: ['role-vanguard'], health: '650' });

    for (const [role, health] of [
      ['Duelist', '250'],
      ['Strategist', '300'],
      ['Vanguard', '650'],
    ] as const) {
      controller.selectAbilityKit(role);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(banner()).toEqual({
        kicker: role,
        roleClasses: [`role-${role.toLowerCase()}`],
        health,
      });
    }
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

  it('shows role, matching archetype, and difficulty in the poster kicker and stat bar', () => {
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
    const kicker = element.querySelector('.poster-kicker')?.textContent?.trim();

    expect(kicker).toBe('Strategist · Tempo setter');
    expect(kicker).not.toContain('Flanker');
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
      'Team fit',
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
    const kicker = element.querySelector('.poster-kicker') as HTMLElement;

    expect(kicker.textContent?.trim()).toBe('Strategist');
    expect(kicker.nextElementSibling).toBe(heading);
    expect(heading.textContent?.trim()).toBe('Mantis');
    expect(element.querySelectorAll('.poster-kicker').length).toBe(1);
    expect(element.querySelector('.hero-role')).toBeNull();
  });
});

describe('HeroDetailsComponent collapsible sections', () => {
  it('puts one h3 and nothing else in each collapsible summary, so the summary is named by its heading', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const hero = {
      ...mantis,
      abilities: [{ name: 'Cosmic Ray', type: 'Ultimate', description: 'A beam.' }],
      playstyles: [
        {
          id: 'guide',
          title: 'Backline healer',
          summary: 'Heal from range.',
          whenToUse: 'Against dive.',
          coreIdeas: [],
          upgradeNotes: [],
          ultimateNotes: [],
        },
      ],
    } as Hero;
    const controller = TestBed.runInInjectionContext(() => new HeroesPageComponent());
    const fixture = TestBed.createComponent(HeroDetailsComponent);
    fixture.componentRef.setInput('hero', hero);
    fixture.componentRef.setInput('controller', controller);
    fixture.detectChanges();

    const summaries = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('details.collapsible > summary'),
    ];

    expect(summaries.map((summary) => summary.textContent?.trim())).toEqual([
      'Playstyle Variants',
      'Ultimate Strategy',
    ]);
    for (const summary of summaries) {
      expect(summary.children.length).toBe(1);
      expect(summary.firstElementChild?.tagName).toBe('H3');
    }
  });
});
