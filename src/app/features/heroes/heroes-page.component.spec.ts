import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, SecurityContext } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import type { Hero } from './hero.model';
import { SidebarContent } from '../../core/layout/sidebar/sidebar-content';
import { CommunityKillsService } from '../insights/community-kills.service';
import { HeroMatchupsService } from '../insights/hero-matchups.service';
import { HeroStatsService } from '../insights/hero-stats.service';
import { HeroDataService } from './hero-data.service';
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
    http.match('/api/heroes').forEach((request) =>
      request.flush([hero('mantis', 'Mantis', 'Strategist'), hero('storm', 'Storm', 'Duelist'), hero('thor', 'Thor', 'Vanguard')]),
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
    expect(element.querySelector('[data-testid="hero-count"]')?.textContent?.trim()).toBe('3 heroes');
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
    http.match('/api/heroes').forEach((request) => request.flush('down', { status: 500, statusText: 'Server Error' }));
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

describe('HeroesPageComponent videos in the sidebar', () => {
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
            getHeroRoster: () => of([hero('mantis', 'Mantis', 'Strategist'), hero('luna', 'Luna', 'Strategist')]),
            getHeroVideos: () => of([]),
          },
        },
        { provide: HeroStatsService, useValue: { getHeroStats: () => of(null) } },
        { provide: HeroMatchupsService, useValue: { getHeroMatchups: () => of(null) } },
        { provide: CommunityKillsService, useValue: { getKills: () => of(null) } },
      ],
    });
    harness = await RouterTestingHarness.create();
    page = await harness.navigateByUrl('/heroes/mantis', HeroesPageComponent);
  });

  it('supplies the videos on a hero page and not on the roster', async () => {
    const content = TestBed.inject(SidebarContent);

    expect(content.template()).not.toBeNull();

    await harness.navigateByUrl('/heroes');

    expect(content.template()).toBeNull();
  });

  it('removes the videos when the page goes away', () => {
    const content = TestBed.inject(SidebarContent);

    harness.fixture.destroy();

    expect(content.template()).toBeNull();
  });

  it('keeps the same player address object for a video heroes of one role share, so the player does not reload', async () => {
    const before = page.selectedHeroVideos()[0];

    await harness.navigateByUrl('/heroes/luna');

    expect(page.selectedHero()?.name).toBe('Luna');
    expect(page.selectedHeroVideos()[0].player).toBe(before.player);
  });

  it('gives a single video a thumbnail from YouTube and a player on the privacy-enhanced host that autoplays', () => {
    const player = page.selectedHeroVideos()[0].player;
    const embed = TestBed.inject(DomSanitizer).sanitize(SecurityContext.RESOURCE_URL, player?.embedUrl ?? null);
    const id = player?.thumbnailUrl.match(/^https:\/\/i\.ytimg\.com\/vi\/([\w-]+)\/hqdefault\.jpg$/)?.[1];

    expect(id).toBeTruthy();
    expect(embed).toBe(`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`);
  });

  it('gives a video that is only a YouTube search link no player', () => {
    const [, gameplay] = page.selectedHeroVideos();

    expect(gameplay.url).toContain('youtube.com/results');
    expect(gameplay.player).toBeUndefined();
  });
});
