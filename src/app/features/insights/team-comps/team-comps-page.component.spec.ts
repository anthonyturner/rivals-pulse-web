import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroSynergies } from '../../../../contracts/hero-synergies.model';
import type { Hero } from '../../heroes/hero.model';
import { heroOf, season } from '../hero-matchup.fixtures';
import { synergiesOf, synergy } from '../hero-synergies.fixtures';
import { TeamCompsPageComponent } from './team-comps-page.component';

const ROSTER = [
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('hela', 'Hela', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
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

  /** Opens the page, answers its two requests, and returns what it drew. */
  async function open(synergies: HeroSynergies | 'failure', roster: Hero[] = ROSTER): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/team-comps');
    http.expectOne('/api/heroes').flush(roster);

    const request = http.expectOne('/api/hero-synergies');

    if (synergies === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(synergies);
    }

    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');

    return element;
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
    http.expectOne('/api/hero-synergies');
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

  it('says "Not enough data yet" for the triple-support and line-up sections', async () => {
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
    expect(element.querySelector('.meta')).toBeNull();
  });

  it('names the previous half-season when it stands in for the current one', async () => {
    const element = await open(
      synergiesOf([synergy('hulk', 'thor', 9, 12)], { halfSeason: season(10), inPlaceOf: season(10.5) }),
    );

    expect(element.querySelector('app-notice')?.textContent).toContain('Season 10.5 does not have enough data yet');
  });

  it('says so, and shows no empty duo tables, when the numbers cannot be loaded', async () => {
    const element = await open('failure');

    expect(element.querySelector('[role="status"]')?.textContent).toContain('Team comps could not be loaded');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('says so, not "Not enough data yet", when the roster cannot be loaded', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/team-comps');
    http.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });
    http.expectOne('/api/hero-synergies').flush(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).toContain('Team comps could not be loaded');
    expect(element.querySelector('.empty')).toBeNull();
  });

  it('explains how the numbers are counted', async () => {
    const element = await open(synergiesOf([synergy('hulk', 'thor', 9, 12)]));
    const note = element.querySelector('.method-note')?.textContent ?? '';

    expect(note).toContain('all ranks together');
    expect(note).toContain('Quick Match and Competitive are counted together');
    expect(element.querySelector('.method-note a')?.getAttribute('href')).toBe('/how-we-count');
  });
});
