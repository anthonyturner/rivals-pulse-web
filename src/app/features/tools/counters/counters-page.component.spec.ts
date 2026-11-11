import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { Hero } from '../../heroes/hero.model';
import { heroOf, matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import { CountersPageComponent } from './counters-page.component';

const roster = [
  heroOf('angela', 'Angela', 'Vanguard'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('spider-man', 'Spider-Man', 'Duelist'),
  heroOf('peni-parker', 'Peni Parker', 'Vanguard'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('psylocke', 'Psylocke', 'Duelist'),
  heroOf('magik', 'Magik', 'Duelist'),
];

describe('CountersPageComponent', () => {
  let fixture: ComponentFixture<CountersPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CountersPageComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /** Opens the page; `matchups` is what `/api/hero-matchups` answers, or a status code for a failed call. */
  async function open(
    matchups: HeroMatchups | number | 'pending',
    heroes: Hero[] | 'pending' = roster,
  ): Promise<HTMLElement> {
    fixture = TestBed.createComponent(CountersPageComponent);
    fixture.detectChanges();

    const heroRequest = http.expectOne('/api/heroes');
    if (heroes !== 'pending') {
      heroRequest.flush(heroes);
    }

    const request = http.expectOne('/api/hero-matchups');
    if (typeof matchups === 'number') {
      request.flush('down', { status: matchups, statusText: 'Server Error' });
    } else if (matchups !== 'pending') {
      request.flush(matchups);
    }

    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: ParentNode, selector: string): string => root.querySelector(selector)?.textContent ?? '';
  const names = (root: ParentNode, selector: string): (string | undefined)[] =>
    [...root.querySelectorAll(`${selector} .hero-name`)].map((name) => name.textContent?.trim());
  const panels = (root: HTMLElement): NodeListOf<Element> => root.querySelectorAll('.panel');
  const pickerDetails = (root: HTMLElement): (string | undefined)[] =>
    [...root.querySelectorAll('.hero-list .detail')].map((detail) => detail.textContent?.trim());
  const liveRegions = (root: ParentNode): NodeListOf<Element> =>
    root.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
  const click = async (button: Element | null | undefined): Promise<void> => {
    (button as HTMLButtonElement).click();
    await fixture.whenStable();
  };

  describe('landmarks', () => {
    it('is one page wrapper that leaves the main landmark to the shell, with the headings inside it', async () => {
      const root = await open(matchupsOf([]));

      expect(root.querySelector('div.counters.page-container--wide')).not.toBeNull();
      expect(root.querySelector('main')).toBeNull();
      expect(root.querySelectorAll('header').length).toBe(2);
      expect([...root.querySelectorAll('header')].every((header) => header.closest('.counters') !== null)).toBeTrue();
    });
  });

  describe('the dive planner', () => {
    it('is one line away, as a link, and no longer on this page', async () => {
      const root = await open(matchupsOf([]));

      expect(text(root, '.to-planner')).toBe('Facing several divers? Use the dive planner.');
      expect(root.querySelector('.to-planner a')?.getAttribute('href')).toBe('/dive-planner');
      expect(root.querySelector('.planner, .chip, app-jubilee-case-study')).toBeNull();
    });
  });

  describe('while the roster loads', () => {
    it('shows a loading panel in the list and the result, and announces no hero count', async () => {
      const root = await open(matchupsOf([]), 'pending');

      expect(text(root, '.picker app-state-panel')).toContain('Loading heroes');
      expect(text(root, '.result app-state-panel')).toContain('Loading matchups');
      expect(root.querySelectorAll('.hero-list').length).toBe(0);
      expect(text(root, '[aria-live]').trim()).toBe('');
    });

    it('keeps one live region, not one for each place that waits', async () => {
      const root = await open('pending', 'pending');

      expect(liveRegions(root).length).toBe(1);
    });
  });

  describe('when the roster cannot be loaded', () => {
    it('says so in the list instead of suggesting a different search', async () => {
      const root = await open(matchupsOf([]), []);

      expect(text(root, '.picker')).toContain('Heroes cannot be loaded right now.');
      expect(text(root, '.picker')).not.toContain('No heroes match');
      expect(text(root, '.result')).toContain('Pick a hero to see its matchups');
    });
  });

  describe('when no matchup qualifies yet', () => {
    it('shows one designed empty state for the selected hero, with no NaN', async () => {
      const root = await open(matchupsOf([]));

      expect(text(root, '.result')).toContain('Not enough data yet');
      expect(text(root, '.result')).toContain('No two heroes have faced each other in 10 recorded matches yet');
      expect(panels(root).length).toBe(0);
      expect(root.querySelectorAll('.tiles').length).toBe(0);
      expect(root.textContent).not.toMatch(/NaN|\b0\.0%|Infinity|undefined/);
    });

    it('shows "No matchup yet" on every hero row instead of a count of scraped counters', async () => {
      const root = await open(matchupsOf([]));

      expect(pickerDetails(root)).toEqual(roster.map((hero) => `${hero.role} · No matchup yet`));
    });
  });

  describe('when the matchups cannot be read', () => {
    it('says so in the result and the live region, and the hero list still renders', async () => {
      const root = await open(500);

      expect(text(root, '.result')).toContain('Matchups unavailable');
      expect(text(root, '.result')).toContain('cannot be loaded right now');
      expect(liveRegions(root).length).toBe(1);
      expect(text(root, '[aria-live]')).toContain('cannot be loaded right now. The hero list still works.');
      expect(root.querySelectorAll('.hero-list .pick').length).toBe(roster.length);
      expect(pickerDetails(root).every((detail) => detail?.endsWith('Unavailable'))).toBeTrue();
      expect(root.textContent).not.toMatch(/NaN|Infinity/);
    });
  });

  describe('while the matchups load', () => {
    it('shows a loading panel and no cards', async () => {
      const root = await open('pending');

      expect(root.querySelector('.result [aria-busy="true"]')?.textContent).toContain('Loading');
      expect(root.querySelectorAll('.tiles .pick').length).toBe(0);
      expect(pickerDetails(root).every((detail) => detail?.endsWith('Loading'))).toBeTrue();
    });
  });

  describe('with some matchups', () => {
    const partial = matchupsOf([
      matchup('peni-parker', 'angela', 10, 12),
      matchup('peni-parker', 'black-cat', 9, 12),
      matchup('mantis', 'black-cat', 9, 12),
      matchup('angela', 'mantis', 8, 11),
      matchup('angela', 'peni-parker', 2, 12),
    ]);

    it('lists the heroes that do better than usual against the selected hero, with their win rate, edge and sample', async () => {
      const root = await open(partial);
      const against = panels(root)[0].textContent ?? '';
      const beats = panels(root)[1].textContent ?? '';

      expect(text(root, '.result-head')).toContain('Angela');
      expect(text(root, '.result-head')).toContain('2 matchups');
      expect(against).toContain('Heroes that do better than usual against Angela');
      expect(against).toContain('Peni Parker');
      expect(against).toContain('83.3%');
      expect(against).toContain('+18.2 pts vs usual');
      expect(against).toContain('12 matches');
      expect(beats).toContain('Heroes Angela does better than usual against');
      expect(beats).toContain('Mantis');
      expect(beats).not.toContain('Peni Parker');
      expect(text(root, '.result')).not.toContain('Not enough data yet');
    });

    it('states the counter rule in one note under the lists', async () => {
      const root = await open(partial);

      expect(text(root, '.note')).toContain('at least 3 points above its own usual win rate, over at least 10 recorded matches');
      expect(text(root, '.note')).toContain('The Rivals Pulse app uses the same rule.');
    });

    it('has a labelled, hero-name-only search and a Role filter', async () => {
      const root = await open(partial);

      expect(text(root, '.search')).toContain('Search heroes');
      expect(root.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe('Hero name');
      expect(text(root, 'app-filter-select')).toContain('Role');
    });

    it('filters the list by name and role, announces the count and picks the first hero left', async () => {
      const root = await open(partial);
      const search = root.querySelector('input[type="search"]') as HTMLInputElement;

      search.value = 'cat';
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(names(root, '.hero-list')).toEqual(['Black Cat']);
      expect(text(root, '[aria-live]')).toBe('1 hero. Showing Black Cat');
      expect(text(root, '.result-head h2')).toBe('Black Cat');

      const role = root.querySelector('app-filter-select select') as HTMLSelectElement;
      role.value = 'Vanguard';
      role.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(text(root, '.picker')).toContain('No heroes match');
      expect(text(root, '.result')).toContain('Pick a hero to see its matchups');
    });

    it('lists cards by matches, then name', async () => {
      const root = await open(
        matchupsOf([
          matchup('peni-parker', 'angela', 10, 12),
          matchup('mantis', 'angela', 14, 20),
          matchup('black-cat', 'angela', 9, 12),
        ]),
      );

      expect(names(panels(root)[0], '.tiles')).toEqual(['Mantis', 'Black Cat', 'Peni Parker']);
    });

    it('lets a card pivot to that hero, marking it in the list', async () => {
      const root = await open(partial);

      await click(panels(root)[0].querySelector('.pick'));

      expect(text(root, '.result-head h2')).toBe('Peni Parker');
      expect(root.querySelector('.hero-list [aria-current="true"]')?.textContent).toContain('Peni Parker');
    });

    it('moves focus to the new hero heading when a card is chosen', async () => {
      const root = await open(partial);

      await click(panels(root)[0].querySelector('.pick'));

      expect(document.activeElement).toBe(root.querySelector('.result-head h2'));
    });

    it('keeps the two panels in place when the hero changes', async () => {
      const root = await open(partial);
      const before = [...panels(root)];

      await click(root.querySelectorAll('.hero-list .pick')[3]);

      expect([...panels(root)]).toEqual(before);
    });

    it('opens the hero named in the address and links to it on the Heroes page', async () => {
      const route = TestBed.inject(ActivatedRoute);
      Object.defineProperty(route.snapshot, 'queryParamMap', { value: convertToParamMap({ hero: 'mantis' }) });
      const root = await open(partial);

      expect(text(root, '.result-head h2')).toBe('Mantis');
      expect(root.querySelector('.link')?.getAttribute('href')).toBe('/heroes/mantis');
    });

    it('labels the previous half-season when it stands in for the current one', async () => {
      const root = await open({ ...partial, halfSeason: season(10), inPlaceOf: season(10.5) });

      expect(text(root, '.source')).toContain('Half-season: Season 10');
      expect(text(root, '.source')).toContain(`${roster.length} heroes`);
      expect(text(root, 'app-notice')).toContain(
        "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
      );
    });
  });

  describe('what the page no longer shows', () => {
    it('ignores the old scraped counter lists on the heroes entirely', async () => {
      const root = await open(matchupsOf([]));
      const page = root.textContent ?? '';

      expect(page).not.toContain('Counter picks are still being curated');
      expect(page).not.toContain('Most Counter-Mapped');
      expect(page).not.toContain('Concept Counters');
      expect(page).not.toContain('coaching mappings');
    });

    it('describes records and never orders heroes to ban', async () => {
      const root = await open(
        matchupsOf([matchup('peni-parker', 'angela', 10, 12), matchup('mantis', 'black-cat', 9, 12)]),
      );

      expect(root.textContent).not.toMatch(/\bban\b|\bbans\b|banned|\bban order\b/i);
    });
  });
});
