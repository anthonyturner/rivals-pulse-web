import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NAVIGATION_CATEGORIES } from '../../core/navigation/navigation-category.data';
import { HubBentoComponent } from '../hub/hub-bento/hub-bento.component';
import { heroOf, matchup, matchupsOf } from '../insights/hero-matchup.fixtures';
import { synergiesOf, synergy } from '../insights/hero-synergies.fixtures';
import { TOOL_TILES } from './tool-tiles.data';

const links = (NAVIGATION_CATEGORIES.find((category) => category.label === 'Tools')?.items ?? []).filter(
  (item) => item.enabled,
);

const ROSTER = [
  heroOf('angela', 'Angela', 'Duelist'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('spider-man', 'Spider-Man', 'Duelist'),
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
];

const MATCHUPS = matchupsOf([
  matchup('hulk', 'angela', 11, 12),
  matchup('mantis', 'angela', 14, 20),
  matchup('storm', 'angela', 8, 10),
  matchup('thor', 'angela', 7, 8),
  matchup('hulk', 'black-cat', 9, 12),
  matchup('storm', 'black-cat', 8, 10),
  matchup('hulk', 'spider-man', 9, 12),
]);

describe('The Tools hub', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<HubBentoComponent>;
  let element: HTMLElement;

  function render(platform: 'browser' | 'server' = 'browser'): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HubBentoComponent);
    fixture.componentRef.setInput('links', links);
    fixture.componentRef.setInput('config', TOOL_TILES);
    fixture.detectChanges();
    element = fixture.nativeElement;
  }

  async function answerWith(answers: { matchups?: object; heroes?: object; synergies?: object }): Promise<void> {
    const reply = (url: string, body: object | undefined): void => {
      const request = http.expectOne((candidate) => candidate.url === url);

      if (body === undefined) {
        request.flush('down', { status: 500, statusText: 'Server Error' });
      } else {
        request.flush(body);
      }
    };

    reply('/api/hero-matchups', answers.matchups);
    reply('/api/heroes', answers.heroes);
    reply('/api/hero-synergies', answers.synergies);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const tile = (label: string): HTMLElement =>
    Array.from(element.querySelectorAll<HTMLElement>('app-hub-tile')).find(
      (candidate) => candidate.querySelector('a')?.textContent?.trim() === label,
    ) as HTMLElement;
  const flat = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const portraits = (node: Element): (string | null)[] =>
    Array.from(node.querySelectorAll('img')).map((image) => image.getAttribute('src'));

  beforeEach(() => spyOn(console, 'error'));

  afterEach(() => http.verify());

  describe('before any data has arrived', () => {
    beforeEach(() => {
      render();
      http.match(() => true);
    });

    it('lays the three tools out with Counters as the lead tile', () => {
      const names = Array.from(element.querySelectorAll('app-hub-tile h2')).map((heading) => flat(heading));
      const sizes = Array.from(element.querySelectorAll('.cell')).map((cell) => cell.getAttribute('data-size'));

      expect(names).toEqual(['Counters', 'Dive Planner', 'Team Builder']);
      expect(sizes).toEqual(['feature', 'tall', 'wide']);
    });

    it('makes every tile one link named by its label', () => {
      for (const link of links) {
        const anchors = tile(link.label).querySelectorAll('a');

        expect(anchors.length).toBe(1);
        expect(flat(anchors[0])).toBe(link.label);
        expect(anchors[0].getAttribute('href')).toBe(link.path);
      }
    });

    it('tints each chip by kind, and the lead tile red', () => {
      const chip = (label: string): string[] => {
        const node = tile(label).querySelector('.chip');

        return [flat(node), node?.getAttribute('data-kind') as string];
      };

      expect(chip('Counters')).toEqual(['Matchups', 'tertiary']);
      expect(chip('Dive Planner')).toEqual(['Planner', 'secondary']);
      expect(chip('Team Builder')).toEqual(['Builder', 'accent']);
      expect(tile('Counters').getAttribute('data-tint')).toBe('danger');
      expect(tile('Dive Planner').getAttribute('data-tint')).toBeNull();
      expect(tile('Team Builder').classList).toContain('split');
    });

    it('draws no figure in a preview that has no data yet', () => {
      for (const link of links) {
        expect(flat(tile(link.label).querySelector('.preview'))).toBe('');
        expect(tile(link.label).querySelectorAll('.preview img').length).toBe(0);
      }
    });
  });

  it('shows the enemy with the strongest record against it and the heroes that counter it', async () => {
    render();
    await answerWith({ matchups: MATCHUPS, heroes: ROSTER, synergies: synergiesOf([]) });

    const counters = tile('Counters');

    expect(portraits(counters.querySelector('.enemy') as HTMLElement)).toEqual(['/images/heroes/angela.png']);
    expect(flat(counters.querySelector('.enemy')?.parentElement ?? null)).toContain('Enemy');
    // Largest sample first, as the Counters page lists them, and three at most.
    expect(portraits(counters.querySelector('.answers') as HTMLElement)).toEqual([
      '/images/heroes/mantis.png',
      '/images/heroes/hulk.png',
      '/images/heroes/storm.png',
    ]);
    expect(Array.from(counters.querySelectorAll('.pill')).map((pill) => flat(pill))).toEqual(['70.0%', '91.7%', '80.0%']);
  });

  it('shows the planner’s opening divers and the heroes that answer the most of them', async () => {
    render();
    await answerWith({ matchups: MATCHUPS, heroes: ROSTER, synergies: synergiesOf([]) });

    const planner = tile('Dive Planner');

    expect(portraits(planner.querySelector('.heroes--enemy') as HTMLElement)).toEqual([
      '/images/heroes/angela.png',
      '/images/heroes/black-cat.png',
      '/images/heroes/spider-man.png',
    ]);
    expect(portraits(planner.querySelector('.heroes--answer') as HTMLElement)).toEqual([
      '/images/heroes/hulk.png',
      '/images/heroes/storm.png',
      '/images/heroes/mantis.png',
    ]);
  });

  it('fills the team slots from the best duo of each role and leaves the rest as plus signs', async () => {
    render();
    await answerWith({
      matchups: MATCHUPS,
      heroes: ROSTER,
      synergies: synergiesOf([synergy('hulk', 'thor', 9, 12), synergy('storm', 'hela', 7, 12)]),
    });

    const slots = Array.from(tile('Team Builder').querySelectorAll('.slot'));

    expect(slots.map((slot) => slot.getAttribute('data-role'))).toEqual([
      'Vanguard',
      'Vanguard',
      'Duelist',
      'Duelist',
      'Strategist',
      'Strategist',
    ]);
    expect(slots.map((slot) => slot.querySelector('img')?.getAttribute('src') ?? flat(slot))).toEqual([
      '/images/heroes/hulk.png',
      '/images/heroes/thor.png',
      '/images/heroes/storm.png',
      '/images/heroes/hela.png',
      '+',
      '+',
    ]);
    expect(Array.from(tile('Team Builder').querySelectorAll('.legend__item')).map((item) => flat(item))).toEqual([
      'Vanguard',
      'Duelist',
      'Strategist',
    ]);
  });

  it('keeps the preview images decorative and out of the accessibility tree', async () => {
    render();
    await answerWith({
      matchups: MATCHUPS,
      heroes: ROSTER,
      synergies: synergiesOf([synergy('hulk', 'thor', 9, 12)]),
    });

    expect(element.querySelectorAll('img').length).toBeGreaterThan(0);

    for (const image of Array.from(element.querySelectorAll('img'))) {
      expect(image.getAttribute('alt')).toBe('');
    }

    for (const preview of Array.from(element.querySelectorAll('.preview'))) {
      expect(preview.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('still shows every tile, with no figures, when the data cannot be loaded', async () => {
    render();
    await answerWith({});

    expect(element.querySelectorAll('app-hub-tile').length).toBe(links.length);

    for (const link of links) {
      expect(tile(link.label).querySelectorAll('.preview img').length).toBe(0);
      expect(flat(tile(link.label).querySelector('.description'))).toBe(link.description);
    }

    expect(element.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('shows no figure when the data is there but empty', async () => {
    render();
    await answerWith({ matchups: matchupsOf([]), heroes: ROSTER, synergies: synergiesOf([]) });

    for (const link of links) {
      expect(tile(link.label).querySelectorAll('.preview img').length).toBe(0);
      expect(flat(tile(link.label).querySelector('.preview'))).toBe('');
    }
  });

  it('draws no counter for an enemy the roster does not know', async () => {
    render();
    await answerWith({
      matchups: matchupsOf([matchup('hulk', 'someone-new', 11, 12)]),
      heroes: ROSTER,
      synergies: synergiesOf([]),
    });

    expect(tile('Counters').querySelectorAll('.preview img').length).toBe(0);
    expect(tile('Dive Planner').querySelectorAll('.preview img').length).toBe(0);
  });

  it('makes no request on the server, so the render never waits for a preview', () => {
    render('server');

    http.expectNone(() => true);
    expect(element.querySelectorAll('app-hub-tile').length).toBe(links.length);
  });
});
