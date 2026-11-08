import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroSynergies } from '../../../../contracts/hero-synergies.model';
import type { TripleSupportTrios } from '../../../../contracts/triple-support-trios.model';
import type { Hero } from '../../heroes/hero.model';
import { heroOf, season } from '../hero-matchup.fixtures';
import { synergiesOf, synergy } from '../hero-synergies.fixtures';
import { trio, triosOf } from '../triple-support-trios.fixtures';
import { TeamCompsPageComponent } from './team-comps-page.component';

const ROSTER = [
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('loki', 'Loki', 'Strategist'),
  heroOf('luna-snow', 'Luna Snow', 'Strategist'),
];

describe('TeamCompsPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'team-comps', component: TeamCompsPageComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  let harness: RouterTestingHarness;

  /** Answers the pair and trio requests for `query` (the page opens on Competitive), and returns what it drew. */
  function answer(
    synergies: HeroSynergies | 'failure',
    trios: TripleSupportTrios | 'failure',
    query = '?mode=competitive',
  ): HTMLElement {
    for (const [url, body] of [
      [`/api/hero-synergies${query}`, synergies],
      [`/api/triple-support-trios${query}`, trios],
    ] as const) {
      const request = http.expectOne(url);

      if (body === 'failure') {
        request.flush('down', { status: 500, statusText: 'Server Error' });
      } else {
        request.flush(body);
      }
    }

    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');

    return element;
  }

  /** Opens the page, answers its requests, and returns what it drew. */
  async function open(
    synergies: HeroSynergies | 'failure',
    roster: Hero[] = ROSTER,
    trios: TripleSupportTrios | 'failure' = triosOf([]),
  ): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/team-comps');
    http.expectOne('/api/heroes').flush(roster);

    return answer(synergies, trios);
  }

  const text = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '');

  it('says it is loading until the numbers arrive, without announcing it', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/team-comps');
    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading team comps');
    expect(element.querySelector('[role="status"]')).toBeNull();
    http.expectOne('/api/heroes');
    http.expectOne('/api/hero-synergies?mode=competitive');
    http.expectOne('/api/triple-support-trios?mode=competitive');
  });

  it('draws one table per role with its pairs, matches together and win rate', async () => {
    const element = await open(
      synergiesOf([synergy('hulk', 'thor', 9, 12), synergy('hela', 'storm', 6, 20), synergy('hulk', 'storm', 12, 12)]),
    );

    expect(element.querySelector('h1')?.textContent).toBe('Marvel Rivals team comps');
    expect(text(element, '.card h3')).toEqual(['Vanguard duos', 'Duelist duos', 'Strategist duos']);

    const tables = element.querySelectorAll('table');

    expect(tables.length).toBe(2);
    expect(text(tables[0] as HTMLElement, 'tbody th a')).toEqual(['Hulk', 'Thor']);
    expect(text(tables[0] as HTMLElement, 'tbody th .visually-hidden')).toEqual(['and']);
    expect(text(tables[0] as HTMLElement, 'tbody td.col-matches')).toEqual(['12']);
    expect(text(tables[0] as HTMLElement, 'tbody td.col-rate')).toEqual(['75.0%']);
    expect(text(tables[1] as HTMLElement, 'tbody td.col-rate')).toEqual(['30.0%']);
    expect(tables[0].getAttribute('aria-labelledby')).toBe('pairs-vanguard');
    expect(element.querySelector('#pairs-vanguard')?.textContent).toBe('Vanguard duos');
  });

  it('links each hero of a pair to its page, reachable from the keyboard', async () => {
    const element = await open(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    const links = Array.from(element.querySelectorAll('tbody th a'));

    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/heroes/hulk', '/heroes/thor']);
    expect(links.every((link) => link.getAttribute('tabindex') === null)).toBeTrue();
  });

  it('says "Not enough data yet" for a role with no pair at the minimum', async () => {
    const element = await open(synergiesOf([synergy('hulk', 'thor', 9, 12)]));

    expect(text(element, '.card .empty')).toEqual([
      'Not enough data yet. A pair is listed once it has 10 matches together.',
      'Not enough data yet. A pair is listed once it has 10 matches together.',
    ]);
  });

  it('says "Not enough data yet" for the triple-support section below the minimum, and for the line-ups', async () => {
    const element = await open(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    const sections = Array.from(element.querySelectorAll('section'));

    expect(sections.map((section) => section.querySelector('h2')?.textContent)).toEqual([
      'Top duos by role',
      'Triple supports',
      'Line-ups',
    ]);
    expect(text(sections[1] as HTMLElement, 'app-state-panel h3')).toEqual(['Not enough data yet']);
    expect(text(sections[2] as HTMLElement, 'app-state-panel h3')).toEqual(['Not enough data yet']);
    expect(sections[1].querySelector('table')).toBeNull();
    expect(sections[2].querySelector('table')).toBeNull();
  });

  it('still shows every section, each empty, while no pair is counted', async () => {
    const element = await open(synergiesOf([]));

    expect(element.querySelectorAll('table').length).toBe(0);
    expect(text(element, '.card .empty').length).toBe(3);
    expect(text(element, 'app-state-panel h3')).toEqual(['Not enough data yet', 'Not enough data yet']);
    expect(element.querySelector('.meta')?.textContent).toContain('All ranks counted');
  });

  it('names the previous half-season when it stands in for the current one', async () => {
    const element = await open(
      synergiesOf([synergy('hulk', 'thor', 9, 12)], { halfSeason: season(10), inPlaceOf: season(10.5) }),
    );

    expect(element.querySelector('app-notice')?.textContent).toContain('Season 10.5 does not have enough Competitive data yet');
  });

  it('says so, and shows no empty duo tables, when the numbers cannot be loaded', async () => {
    const element = await open('failure');

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Team comps could not be loaded');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('says so, not "Not enough data yet", when the roster cannot be loaded', async () => {
    harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/team-comps');
    http.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/hero-synergies?mode=competitive').flush(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    http.expectOne('/api/triple-support-trios?mode=competitive').flush(triosOf([]));
    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).toContain('Team comps could not be loaded');
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('explains how the numbers are counted', async () => {
    const element = await open(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    const note = element.querySelector('.method-note')?.textContent ?? '';

    expect(note).toContain('all ranks together');
    expect(note).toContain('Competitive is counted unless you pick another mode');
    expect(element.querySelector('.method-note a')?.getAttribute('href')).toBe('/how-we-count');
  });

  describe('the triple supports', () => {
    const TRIOS = triosOf(
      [
        trio(['loki', 'luna-snow', 'mantis'], 'Mantis triple', 30, 18),
        trio(['hela', 'loki', 'luna-snow'], 'Three healers', 40, 16),
      ],
      { classifiedTeams: 200, fourPlusTeams: 6 },
    );
    const PAIRS = synergiesOf([synergy('hulk', 'thor', 9, 12)]);

    it('draws one card per variant with the trio portraits, pick share and win rate', async () => {
      const element = await open(PAIRS, ROSTER, TRIOS);
      const section = element.querySelectorAll('section')[1] as HTMLElement;

      expect(text(section, '.card h3')).toEqual(['Three healers', 'Mantis triple', 'Quad support']);

      const tables = section.querySelectorAll('table');

      expect(tables.length).toBe(2);
      expect(text(tables[0] as HTMLElement, 'thead th')).toEqual(['Trio', 'Pick share', 'Win rate', 'Matches']);
      expect(text(tables[0] as HTMLElement, 'tbody th a')).toEqual(['Hela', 'Loki', 'Luna Snow']);
      expect(text(tables[0] as HTMLElement, 'tbody td')).toEqual(['20.0%', '40.0%', '40']);
      expect(text(tables[1] as HTMLElement, 'tbody td')).toEqual(['15.0%', '60.0%', '30']);
      expect(tables[0].querySelectorAll('tbody th img').length).toBe(3);
      expect(tables[0].getAttribute('aria-labelledby')).toBe(section.querySelector('.card h3')?.id ?? 'missing');
    });

    it('shows the Quad support count', async () => {
      const element = await open(PAIRS, ROSTER, TRIOS);
      const section = element.querySelectorAll('section')[1] as HTMLElement;

      const quad = Array.from(section.querySelectorAll('.card')).find((card) => card.querySelector('h3')?.textContent === 'Quad support');

      expect(quad?.textContent?.replace(/\s+/g, ' ')).toContain('6 of 200 teams (3.0%) ran four or more Strategists');
      expect(section.querySelector('app-state-panel')).toBeNull();
    });

    it('says the triple supports could not be loaded without hiding the duos', async () => {
      const element = await open(PAIRS, ROSTER, 'failure');

      expect(element.querySelectorAll('section')[0].querySelector('table')).not.toBeNull();
      expect(text(element, 'app-state-panel h3')[0]).toBe('Triple supports could not be loaded');
      expect(element.textContent).not.toContain('Team comps could not be loaded');
    });
  });

  describe('the half-season and mode pickers', () => {
    const PAIRS = synergiesOf([synergy('hulk', 'thor', 9, 12)]);

    it('opens on Competitive and states that all ranks are counted', async () => {
      const element = await open(PAIRS);
      const selects = Array.from(element.querySelectorAll('.toolbar select')) as HTMLSelectElement[];

      expect(text(element, '.toolbar label span').slice(0, 2)).toEqual(['Mode', 'Season']);
      expect(selects[0].value).toBe('competitive');
      expect(selects[1].value).toBe('10.5');
      expect(Array.from(selects[0].options).map((option) => option.textContent?.trim())).toEqual([
        'Quick Match and Competitive',
        'Quick Match',
        'Competitive',
      ]);
      expect(Array.from(selects[1].options).map((option) => option.textContent?.trim())).toEqual(['Season 10.5', 'Season 10']);
      expect(element.querySelector('.meta')?.textContent).toContain('All ranks counted');
    });

    it('asks both endpoints for the mode picked, keeping the half-season', async () => {
      const element = await open(PAIRS);
      const mode = element.querySelectorAll('.toolbar select')[0] as HTMLSelectElement;

      mode.value = 'quick-match';
      mode.dispatchEvent(new Event('change'));
      harness.detectChanges();

      expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading team comps');

      const picked = answer(
        synergiesOf([synergy('hulk', 'thor', 3, 12)], { mode: 'quick-match' }),
        triosOf([], { mode: 'quick-match' }),
        '?mode=quick-match',
      );

      expect(text(picked, 'tbody td.col-rate')).toEqual(['25.0%']);
      expect((picked.querySelectorAll('.toolbar select')[0] as HTMLSelectElement).value).toBe('quick-match');
      expect(picked.querySelector('[aria-live="polite"]')?.textContent).toBe(
        'Team comps updated in Quick Match for Season 10.5',
      );
    });

    it('asks both endpoints for exactly the half-season picked', async () => {
      const element = await open(PAIRS);
      const picker = element.querySelectorAll('.toolbar select')[1] as HTMLSelectElement;

      picker.value = '10';
      picker.dispatchEvent(new Event('change'));
      harness.detectChanges();

      const picked = answer(
        synergiesOf([synergy('hulk', 'thor', 3, 12)], { halfSeason: season(10) }),
        triosOf([], { halfSeason: season(10) }),
        '?halfSeason=10&mode=competitive',
      );

      expect((picked.querySelectorAll('.toolbar select')[1] as HTMLSelectElement).value).toBe('10');
      expect(picked.querySelector('.meta')?.textContent).toContain('Season 10');
    });

    it('keeps the pickers when the numbers for a pick cannot be loaded', async () => {
      const element = await open(PAIRS);
      const mode = element.querySelectorAll('.toolbar select')[0] as HTMLSelectElement;

      mode.value = 'quick-match';
      mode.dispatchEvent(new Event('change'));
      harness.detectChanges();

      const failed = answer('failure', triosOf([]), '?mode=quick-match');

      expect(failed.textContent).toContain('Team comps could not be loaded');
      expect(failed.querySelectorAll('.toolbar select').length).toBe(2);
    });

    it('says why Deadpool is not in the duo lists', async () => {
      const element = await open(PAIRS);

      expect(text(element, '#pairs-title + p')[0]).toContain(
        'Deadpool is not listed: he plays as a Vanguard, Duelist or Strategist depending on his form',
      );
    });
  });
});
