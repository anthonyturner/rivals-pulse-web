import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NAVIGATION_CATEGORIES } from '../../core/navigation/navigation-category.data';
import { heroOf } from '../insights/hero-matchup.fixtures';
import { statsHero, statsOf } from '../insights/hero-stats.fixtures';
import { synergiesOf, synergy } from '../insights/hero-synergies.fixtures';
import type { GlossaryTerm } from '../reference/glossary/glossary.model';
import { LOCAL_DATE } from '../../shared/utilities/local-date';
import { HubBentoComponent } from '../hub/hub-bento/hub-bento.component';
import { RESOURCE_TILES } from './resource-tiles.data';

const links = (NAVIGATION_CATEGORIES.find((category) => category.label === 'Resources')?.items ?? []).filter(
  (item) => item.enabled,
);

const ROSTER = [
  heroOf('hulk', 'Hulk', 'Vanguard'),
  heroOf('thor', 'Thor', 'Vanguard'),
  heroOf('storm', 'Storm', 'Duelist'),
  heroOf('mantis', 'Mantis', 'Strategist'),
];

const TERM: GlossaryTerm = {
  id: 'dive',
  term: 'Dive',
  category: 'Combat',
  definition: 'A coordinated attack where heroes jump on a vulnerable target.',
  coachNote: '',
  example: '',
  relatedTerms: [],
  sourceName: 'Manual seed data',
  sourceUrl: '/glossary',
};

describe('The Resources hub', () => {
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
        { provide: LOCAL_DATE, useValue: () => new Date(2026, 10, 7) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HubBentoComponent);
    fixture.componentRef.setInput('links', links);
    fixture.componentRef.setInput('config', RESOURCE_TILES);
    fixture.detectChanges();
    element = fixture.nativeElement;
  }

  async function answerWith(answers: { heroStats?: object; heroes?: object; glossary?: object; synergies?: object }): Promise<void> {
    const reply = (url: string, body: object | string): void => {
      const request = http.expectOne((candidate) => candidate.url === url);

      // The Team comps preview shows what the page it links to opens on.
      if (url === '/api/hero-synergies') {
        expect(request.request.params.get('mode')).toBe('competitive');
      }

      if (body === 'error') {
        request.flush('down', { status: 500, statusText: 'Server Error' });
      } else {
        request.flush(body);
      }
    };

    reply('/api/hero-stats', answers.heroStats ?? 'error');
    reply('/api/heroes', answers.heroes ?? 'error');
    reply('/api/glossary', answers.glossary ?? 'error');
    reply('/api/hero-synergies', answers.synergies ?? 'error');
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const tile = (label: string): HTMLElement =>
    Array.from(element.querySelectorAll<HTMLElement>('app-hub-tile')).find(
      (candidate) => candidate.querySelector('a')?.textContent?.trim() === label,
    ) as HTMLElement;
  const flat = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  beforeEach(() => spyOn(console, 'error'));

  afterEach(() => http.verify());

  describe('before any data has arrived', () => {
    beforeEach(() => {
      render();
      // The previews are asking; this group looks at the tiles alone.
      http.match(() => true);
    });

    it('lays the released links out in the grid order, one tile each', () => {
      const names = Array.from(element.querySelectorAll('app-hub-tile h2')).map((heading) => flat(heading));

      expect(names).toEqual([
        'Media Tutorials',
        'Tier List',
        'Hero stats',
        'Strategist Guides',
        'User Highlights',
        'Game Stats',
        'Glossary',
        'Team Comps',
      ]);
    });

    it('makes every tile one link named by its label', () => {
      for (const link of links) {
        const anchors = tile(link.label).querySelectorAll('a');

        expect(anchors.length).toBe(1);
        expect(flat(anchors[0])).toBe(link.label);
        expect(anchors[0].getAttribute('href')).toBe(link.path);
        expect(tile(link.label).textContent).toContain(link.description);
      }
    });

    it('sizes the tiles by kind, with Media Tutorials as the feature', () => {
      const sizes = Array.from(element.querySelectorAll('.cell')).map((cell) => cell.getAttribute('data-size'));

      expect(sizes).toEqual(['feature', 'tall', 'half', 'half', 'third', 'third', 'note', 'wide']);
      expect(element.querySelectorAll('app-hub-tile.featured').length).toBe(1);
      expect(tile('Media Tutorials').classList).toContain('featured');
    });

    it('puts key art behind the feature and keeps it out of the accessibility tree', () => {
      const images = Array.from(tile('Media Tutorials').querySelectorAll('img'));

      expect(images.length).toBe(1);
      expect(images[0].getAttribute('alt')).toBe('');
      expect(images[0].getAttribute('src')).toBe('/images/site/heroes-banner.jpg');
      expect(tile('Media Tutorials').querySelector('.marker')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('tints each chip by kind', () => {
      const chips = (label: string): string[] | undefined => {
        const chip = tile(label).querySelector('.chip');

        return chip ? [flat(chip), chip.getAttribute('data-kind') as string] : undefined;
      };

      expect(chips('Media Tutorials')).toEqual(['Learn', 'accent']);
      expect(chips('Strategist Guides')).toEqual(['Learn', 'accent']);
      expect(chips('Hero stats')).toEqual(['Stats', 'secondary']);
      expect(chips('Game Stats')).toEqual(['Stats', 'secondary']);
      expect(chips('Glossary')).toEqual(['Reference', 'secondary']);
      expect(chips('Tier List')).toEqual(['Community', 'tertiary']);
      expect(chips('User Highlights')).toEqual(['Community', 'tertiary']);
    });

    it('shows the strategist guides preview, which needs no request', () => {
      expect(flat(tile('Strategist Guides').querySelector('.topics'))).toContain('Fundamentals');
      expect(tile('Strategist Guides').querySelectorAll('.heroes img').length).toBeGreaterThan(0);
    });

    it('draws no figure in a preview that has no data yet', () => {
      for (const label of ['Tier List', 'Hero stats', 'Game Stats', 'Glossary', 'Team Comps']) {
        expect(flat(tile(label).querySelector('.preview'))).toBe('');
      }
    });
  });

  it('fills the previews from the site data once it arrives', async () => {
    render();
    await answerWith({
      heroStats: statsOf([
        {
          name: 'S',
          heroes: [statsHero('hulk', 20, 16, 10, 'S'), statsHero('thor', 20, 14, 10, 'S')],
        },
        { name: 'A', heroes: [statsHero('storm', 20, 12, 10, 'A')] },
      ]),
      heroes: ROSTER,
      glossary: [TERM],
      synergies: synergiesOf([synergy('hulk', 'thor', 9, 12)]),
    });

    const tiers = Array.from(tile('Tier List').querySelectorAll('.row')).map((row) => flat(row.querySelector('.letter')));
    expect(tiers).toEqual(['S', 'A']);
    expect(tile('Tier List').querySelectorAll('.heroes img').length).toBe(3);

    const text = (label: string, selector: string): string[] =>
      Array.from(tile(label).querySelectorAll(selector)).map((node) => flat(node));

    expect(text('Hero stats', '.name')).toEqual(['Hulk', 'Thor', 'Storm']);
    expect(text('Hero stats', '.rate')).toEqual(['80.0%', '70.0%', '60.0%']);
    expect(tile('Hero stats').querySelector<HTMLElement>('.fill')?.style.width).toBe('80%');

    expect(text('Game Stats', '.count')).toEqual(['4']);
    expect(text('Glossary', '.word')).toEqual(['Dive']);
    expect(text('Glossary', '.definition')).toEqual([TERM.definition]);
    expect(text('Team Comps', '.role')).toEqual(['Vanguard duo']);
    expect(text('Team Comps', '.rate')).toEqual(['75.0%']);
  });

  it('keeps the preview images decorative and out of the accessibility tree', async () => {
    render();
    await answerWith({
      heroStats: statsOf([{ name: 'S', heroes: [statsHero('hulk', 20, 16, 10, 'S')] }]),
      heroes: ROSTER,
      glossary: [TERM],
      synergies: synergiesOf([]),
    });

    for (const image of Array.from(element.querySelectorAll('img'))) {
      expect(image.getAttribute('alt')).toBe('');
    }

    for (const preview of Array.from(element.querySelectorAll('.preview'))) {
      expect(preview.getAttribute('aria-hidden')).toBe('true');
    }

    expect(tile('Tier List').querySelectorAll('a').length).toBe(1);
  });

  it('still shows every tile, with no figures, when the data cannot be loaded', async () => {
    render();
    await answerWith({});

    expect(element.querySelectorAll('app-hub-tile').length).toBe(links.length);

    for (const label of ['Tier List', 'Hero stats', 'Game Stats', 'Glossary', 'Team Comps']) {
      expect(flat(tile(label).querySelector('.preview'))).toBe('');
      expect(flat(tile(label).querySelector('.description'))).not.toBe('');
      expect(tile(label).querySelector('.chip')).not.toBeNull();
    }

    expect(element.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('shows no figure when the data is there but empty', async () => {
    render();
    await answerWith({ heroStats: statsOf([]), heroes: [], glossary: [], synergies: synergiesOf([]) });

    for (const label of ['Tier List', 'Hero stats', 'Game Stats', 'Glossary', 'Team Comps']) {
      expect(flat(tile(label).querySelector('.preview'))).toBe('');
    }
  });

  it('makes no request on the server, so the render never waits for a preview', () => {
    render('server');

    http.expectNone(() => true);
    expect(element.querySelectorAll('app-hub-tile').length).toBe(links.length);
  });

  it('loads the lead tile key art at once, since it is in view when the page opens', () => {
    render();
    http.match(() => true);

    const art = element.querySelector('.art__image');

    expect(art).not.toBeNull();
    expect(art?.hasAttribute('loading')).toBeFalse();
  });

  it('gives a link the tile data does not name a plain tile after the others', () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    const plain = TestBed.createComponent(HubBentoComponent);
    plain.componentRef.setInput('links', [{ label: 'New thing', path: '/new-thing', description: 'Something new.' }, ...links]);
    plain.componentRef.setInput('config', RESOURCE_TILES);
    plain.detectChanges();
    http.match(() => true);

    const cells = Array.from(plain.nativeElement.querySelectorAll('.cell')) as HTMLElement[];
    const last = cells[cells.length - 1];

    expect(flat(last.querySelector('h2'))).toBe('New thing');
    expect(last.getAttribute('data-size')).toBe('third');
    expect(last.querySelector('.chip')).toBeNull();
  });
});
