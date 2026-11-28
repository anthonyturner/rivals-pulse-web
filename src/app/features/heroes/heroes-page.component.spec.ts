import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, SecurityContext } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, Subject } from 'rxjs';

import type { Hero } from './hero.model';
import { SidebarContent } from '../../core/layout/sidebar/sidebar-content';
import { CommunityKillsService } from '../insights/community-kills.service';
import { CurrentHeroMatchupsService } from '../insights/current-hero-matchups.service';
import { HeroSwitchInsService } from '../insights/hero-switch-ins.service';
import { CurrentHeroStatsService } from '../insights/current-hero-stats.service';
import { HeroDataService } from './hero-data.service';
import { HeroScoresService } from './hero-scores.service';
import { heroesMatcher } from './heroes.routes';
import { HeroesPageComponent } from './heroes-page.component';

const hero = (id: string, name: string, role: Hero['role']): Hero =>
  ({
    id,
    name,
    role,
    difficulty: 3,
    summary: `${name} summary.`,
    playstyle: '',
    strengths: [],
    weaknesses: [],
    counters: [],
    synergies: [],
    abilities: [],
    imageUrl: `/images/heroes/${id}.png`,
  }) as Hero;

describe('HeroesPageComponent', () => {
  let fixture: ComponentFixture<HeroesPageComponent>;
  let element: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HeroesPageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  async function loadRoster(): Promise<void> {
    http
      .match('/api/heroes')
      .forEach((request) =>
        request.flush([
          hero('mantis', 'Mantis', 'Strategist'),
          hero('storm', 'Storm', 'Duelist'),
          hero('thor', 'Thor', 'Vanguard'),
        ]),
    );
    http.match('/api/hero-videos').forEach((request) => request.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('uses the wide page container and a plain "Heroes" title', async () => {
    await loadRoster();

    expect(element.querySelector('.heroes-page')?.classList).toContain('page-container--wide');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Heroes');
  });

  it('shows placeholders, not an empty message, until the roster arrives', async () => {
    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelector('.empty-state')).toBeNull();

    await loadRoster();

    expect(element.querySelector('[aria-busy="true"]')).toBeNull();
    expect(element.querySelectorAll('.hero-card').length).toBe(3);
  });

  it('shows the roster and no hero until one is chosen, and lists the count', async () => {
    await loadRoster();

    expect(element.querySelector('.hero-detail')).toBeNull();
    expect(element.querySelector('[aria-current="page"]')).toBeNull();
    expect(element.querySelector('[data-testid="hero-count"]')?.textContent?.trim()).toBe(
      '3 heroes',
    );
  });

  it('renders no profile window or open-profile button, even after Escape', async () => {
    await loadRoster();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="open-profile"]')).toBeNull();
    expect(element.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('says so, and offers no roster, when the heroes could not be loaded', async () => {
    spyOn(console, 'error');
    http
      .match('/api/heroes')
      .forEach((request) => request.flush('down', { status: 500, statusText: 'Server Error' }));
    http.match('/api/hero-videos').forEach((request) => request.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.textContent).toContain('Heroes could not be loaded');
    expect(element.querySelector('app-hero-grid')).toBeNull();
    expect(element.querySelector('.empty-state')).toBeNull();
  });

  it('shows the empty message when no hero matches the filters in the address', async () => {
    await loadRoster();

    fixture.componentInstance.updateSearchTerm('zzzz');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.empty-state')).not.toBeNull();
    expect(element.querySelector('.hero-detail')).toBeNull();
  });
});

describe('HeroesPageComponent videos in hero tabs', () => {
  let harness: RouterTestingHarness;
  let page: HeroesPageComponent;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ matcher: heroesMatcher, component: HeroesPageComponent }]),
        {
          provide: HeroDataService,
          useValue: {
            getHeroRoster: () =>
              of([hero('mantis', 'Mantis', 'Strategist'), hero('luna', 'Luna', 'Strategist')]),
            getHeroVideos: () =>
              of([{ heroId: 'luna', videoType: 'paz-gameplay', youtubeId: 'lunaPaz', title: 'Luna PAZ' }]),
          },
        },
        { provide: CurrentHeroStatsService, useValue: { getHeroStats: () => of(null) } },
        { provide: HeroScoresService, useValue: { getHeroScores: () => of(null) } },
        { provide: CurrentHeroMatchupsService, useValue: { getHeroMatchups: () => of(null) } },
        { provide: HeroSwitchInsService, useValue: { getHeroSwitchIns: () => of(null) } },
        { provide: CommunityKillsService, useValue: { getKills: () => of(null) } },
      ],
    });
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/heroes/mantis', HeroesPageComponent);
  });

  it('renders videos in the hero details and not in the global sidebar or roster', async () => {
    const content = TestBed.inject(SidebarContent);

    expect(content.template()).toBeNull();
    expect(page.selectedHeroVideos().length).toBeGreaterThan(0);
    expect(
      harness.routeNativeElement?.querySelector('.hero-section-tabs #hero-tab-videos-mantis'),
    ).not.toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('#hero-panel-videos-mantis app-hero-videos'),
    ).not.toBeNull();

    await harness.navigateByUrl('/heroes');

    expect(content.template()).toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-hero-videos')).toBeNull();
  });

  it('keeps the sidebar empty when the hero page goes away', () => {
    const content = TestBed.inject(SidebarContent);

    harness.fixture.destroy();

    expect(content.template()).toBeNull();
  });

  it('gives a single video its YouTube id, for the player to load on a click', () => {
    const [video] = page.selectedHeroVideos();

    expect(video.url).toBe(`https://www.youtube.com/watch?v=${video.youtubeId}`);
    expect(video.youtubeId).toMatch(/^[\w-]+$/);
  });

  it('gives the poster a muted, looping backdrop of the hero\'s own PAZ gameplay video', async () => {
    await harness.navigateByUrl('/heroes/luna');

    const backdrop = TestBed.inject(DomSanitizer).sanitize(
      SecurityContext.RESOURCE_URL,
      page.selectedHeroPosterVideoUrl(),
    );

    expect(backdrop).toBe(
      'https://www.youtube-nocookie.com/embed/lunaPaz?autoplay=1&mute=1&enablejsapi=1&loop=1&playlist=lunaPaz&controls=0&disablekb=1&playsinline=1&rel=0&iv_load_policy=3',
    );
  });

  it('gives the poster no backdrop video when the hero has no PAZ gameplay video of their own', () => {
    expect(page.selectedHeroPosterVideoUrl()).toBeNull();
    expect(harness.routeNativeElement?.querySelector('.backdrop-controls')).toBeNull();
  });

  it('gives a video that is only a YouTube search link no player', () => {
    const [, gameplay] = page.selectedHeroVideos();

    expect(gameplay.url).toContain('youtube.com/results');
    expect(gameplay.youtubeId).toBeUndefined();
  });
});

describe('HeroesPageComponent when the hero service fails', () => {
  let fixture: ComponentFixture<HeroesPageComponent>;
  let element: HTMLElement;
  let rosters: (Hero[] | null)[];
  let requests: number;
  let held: Subject<Hero[] | null> | null;

  beforeEach(() => {
    held = null;
    rosters = [null, [hero('mantis', 'Mantis', 'Strategist'), hero('thor', 'Thor', 'Vanguard')]];
    requests = 0;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: HeroDataService,
          useValue: {
            getHeroRoster: () => {
              const attempt = requests++;

              return held ?? of(rosters[Math.min(attempt, rosters.length - 1)]);
            },
            getHeroVideos: () => of([]),
          },
        },
        { provide: CurrentHeroStatsService, useValue: { getHeroStats: () => of(null) } },
        { provide: HeroScoresService, useValue: { getHeroScores: () => of(null) } },
        { provide: CurrentHeroMatchupsService, useValue: { getHeroMatchups: () => of(null) } },
        { provide: HeroSwitchInsService, useValue: { getHeroSwitchIns: () => of(null) } },
        { provide: CommunityKillsService, useValue: { getKills: () => of(null) } },
      ],
    });
    fixture = TestBed.createComponent(HeroesPageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const retryButton = (): HTMLButtonElement | null =>
    element.querySelector<HTMLButtonElement>('button.retry');

  async function retry(): Promise<void> {
    retryButton()?.click();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('says the heroes could not be loaded, not that no hero matches, and offers a retry', () => {
    expect(element.textContent).toContain('Heroes could not be loaded');
    expect(element.querySelector('.empty-state')).toBeNull();
    expect(element.querySelector('app-hero-grid')).toBeNull();
    expect(retryButton()?.textContent?.trim()).toBe('Try again');
  });

  it('shows the roster once a retry succeeds', async () => {
    await retry();

    expect(requests).toBe(2);
    expect(element.textContent).not.toContain('Heroes could not be loaded');
    expect(element.querySelectorAll('.hero-card').length).toBe(2);
  });

  it('keeps the failure state, and the retry, when the retry fails too', async () => {
    rosters = [null, null];
    await retry();

    expect(requests).toBe(2);
    expect(element.textContent).toContain('Heroes could not be loaded');
    expect(retryButton()?.textContent?.trim()).toBe('Try again');
  });

  it('says the retry is running, and ignores another click, until the answer arrives', async () => {
    held = new Subject<Hero[] | null>();
    await retry();

    expect(requests).toBe(2);
    expect(retryButton()?.textContent?.trim()).toBe('Retrying…');
    expect(retryButton()?.getAttribute('aria-disabled')).toBe('true');
    expect(element.textContent).toContain('Asking for the heroes again.');

    await retry();

    expect(requests).toBe(2);

    held.next([hero('thor', 'Thor', 'Vanguard')]);
    held.complete();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelectorAll('.hero-card').length).toBe(1);
  });

  it('puts focus in the roster search field after a retry brings the roster back', async () => {
    retryButton()?.focus();
    await retry();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(element.querySelector('input[type="search"]'));
  });

  it('changes the message when the retry fails, so the status region announces a result', async () => {
    rosters = [null, null];
    const status = element.querySelector('app-state-panel[role="status"]');

    expect(status?.textContent).toContain('The roster is unavailable right now.');

    await retry();

    expect(status?.textContent).toContain('Still unavailable. Try again in a moment.');
    expect(status?.textContent).not.toContain('The roster is unavailable right now.');
  });
});
