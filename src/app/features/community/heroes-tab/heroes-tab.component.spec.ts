import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { emptyFigures, figuresOf, heroFigures } from '../../insights/community-extended.fixtures';
import { heroOf } from '../../insights/hero-matchup.fixtures';
import { statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { HeroesTabComponent } from './heroes-tab.component';

const READY = statsOf([
  { name: 'S', heroes: [statsHero('storm', 20, 14, 13.4, 'S')] },
  { name: 'B', heroes: [statsHero('hela', 30, 15, 20.1)] },
]);

const FIGURES_READY = figuresOf({}, [
  heroFigures('hela', { damage: 1050 }),
  heroFigures('storm', { damage: 980, healing: 400, blocked: 0 }),
]);

describe('HeroesTabComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HeroesTabComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  async function answer(stats: unknown, status = 200, figures: unknown = FIGURES_READY): Promise<void> {
    http.expectOne('/api/community/figures').flush(figures as object);
    http.expectOne('/api/heroes').flush([heroOf('storm', 'Storm', 'Duelist'), heroOf('hela', 'Hela', 'Duelist')]);
    http
      .expectOne('/api/hero-stats')
      .flush(stats as object, { status, statusText: status === 200 ? 'OK' : 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HeroesTabComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading while the requests run', async () => {
    expect(host().querySelector('[role="status"]')?.textContent).toContain('Loading');
    await answer(READY);
  });

  it('lists the most-picked and highest-winning heroes, each linking to the Heroes page, and links to the full pages', async () => {
    await answer(READY);

    const lists = Array.from(host().querySelectorAll('ol')).slice(0, 2);
    const names = (list: Element): string[] =>
      Array.from(list.querySelectorAll('.hero-list__name')).map((name) => name.textContent?.trim() ?? '');

    expect(lists.map(names)).toEqual([['Hela', 'Storm'], ['Storm', 'Hela']]);
    expect(text()).toContain('20.1%');
    expect(text()).toContain('70.0%');
    expect(text()).toContain('Season 10.5');
    expect(text()).not.toMatch(/NaN|undefined|null/);

    const hrefs = Array.from(host().querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));
    expect(hrefs).toContain('/heroes?hero=storm');
    expect(hrefs).toContain('/heroes');
    expect(hrefs).toContain('/win-rates');
  });

  it('shows the designed empty state, with the minimum named and a link to the full page, when nothing clears the minimum', async () => {
    await answer(statsOf([], { matchesCounted: 12 }));

    expect(host().querySelector('.empty-state')).toBeTruthy();
    expect(text()).toContain('Not enough data yet');
    expect(text()).toContain('10 appearances');
    expect(host().querySelector('a')?.getAttribute('href')).toBe('/heroes');
  });

  it('says the numbers cannot be loaded when the request fails, and shows no empty state', async () => {
    await answer('down', 500);

    expect(text()).toContain('cannot be loaded right now');
    expect(host().querySelector('.empty-state')).toBeNull();
  });

  describe('damage, healing and damage blocked per minute', () => {
    const figuresPanel = (): HTMLElement => host().querySelector('.heroes-tab__figures') as HTMLElement;
    const groups = (): string[][] =>
      Array.from(figuresPanel().querySelectorAll('section section')).map((group) => [
        group.querySelector('h3')?.textContent?.trim() ?? '',
        ...Array.from(group.querySelectorAll('li')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      ]);

    it('lists the leaders of each figure, linking each hero to the Heroes page', async () => {
      await answer(READY);

      expect(groups()).toEqual([
        ['Most damage per minute', 'Hela Damage per minute 1,050', 'Storm Damage per minute 980'],
        ['Most healing per minute', 'Storm Healing per minute 400'],
        ['Most damage blocked per minute'],
      ]);
      expect(figuresPanel().textContent).toContain('No hero here yet.');
      expect(figuresPanel().textContent).toContain('describe those players, not everyone in a lobby');
      expect(figuresPanel().textContent).not.toMatch(/NaN|undefined|null/);
      expect(Array.from(figuresPanel().querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'))).toContain(
        '/heroes?hero=hela',
      );
    });

    it('shows its own designed empty state, naming the minimum, while the pick rates are ready', async () => {
      await answer(READY, 200, emptyFigures());

      expect(figuresPanel().querySelector('.empty-state')).toBeTruthy();
      expect(figuresPanel().textContent).toContain('Not enough data yet');
      expect(figuresPanel().textContent).toContain('10 lines');
      expect(host().querySelectorAll('.hero-list__name').length).toBe(4);
    });

    it('says only itself cannot be loaded when its request fails', async () => {
      await answer(READY, 200, 'down');

      expect(figuresPanel().textContent).toContain('cannot be loaded right now');
      expect(host().querySelectorAll('.hero-list__name').length).toBe(4);
    });
  });
});
