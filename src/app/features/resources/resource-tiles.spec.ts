import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NAVIGATION_CATEGORIES } from '../../core/navigation/navigation-category.data';
import type { GlossaryTerm } from '../reference/glossary/glossary.model';
import { LOCAL_DATE } from '../../shared/utilities/local-date';
import { HubBentoComponent } from '../hub/hub-bento/hub-bento.component';
import { RESOURCE_TILES } from './resource-tiles.data';

const links = (NAVIGATION_CATEGORIES.find((category) => category.label === 'Resources')?.items ?? []).filter(
  (item) => item.enabled,
);

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

  async function answerGlossary(answer: object | 'error'): Promise<void> {
    const request = http.expectOne((candidate) => candidate.url === '/api/glossary');

    if (answer === 'error') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(answer);
    }

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

  it('lists only learning pages: no stat page has a place in it', () => {
    expect(links.map((link) => link.path)).toEqual(['/media-tutorials', '/strategist-guides', '/user-highlights', '/glossary']);
  });

  describe('before any data has arrived', () => {
    beforeEach(() => {
      render();
      // The preview is asking; this group looks at the tiles alone.
      http.match(() => true);
    });

    it('lays the released links out in the grid order, one tile each', () => {
      const names = Array.from(element.querySelectorAll('app-hub-tile h2')).map((heading) => flat(heading));

      expect(names).toEqual(['Media Tutorials', 'User Highlights', 'Glossary', 'Strategist Guides']);
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

      expect(sizes).toEqual(['feature', 'third', 'note', 'wide']);
      expect(element.querySelectorAll('app-hub-tile.featured').length).toBe(1);
      expect(tile('Media Tutorials').classList).toContain('featured');
    });

    it('puts key art behind the feature and keeps it out of the accessibility tree', () => {
      const images = Array.from(tile('Media Tutorials').querySelectorAll('img'));

      expect(images.length).toBe(1);
      expect(images[0].getAttribute('alt')).toBe('');
      expect(images[0].getAttribute('src')).toBe('/images/site/banners/resources-banner.webp');
      expect(tile('Media Tutorials').querySelector('.marker')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('tints each chip by kind', () => {
      const chips = (label: string): string[] | undefined => {
        const chip = tile(label).querySelector('.chip');

        return chip ? [flat(chip), chip.getAttribute('data-kind') as string] : undefined;
      };

      expect(chips('Media Tutorials')).toEqual(['Learn', 'accent']);
      expect(chips('Strategist Guides')).toEqual(['Learn', 'accent']);
      expect(chips('Glossary')).toEqual(['Reference', 'secondary']);
      expect(chips('User Highlights')).toEqual(['Community', 'tertiary']);
    });

    it('shows the strategist guides preview, which needs no request', () => {
      expect(flat(tile('Strategist Guides').querySelector('.topics'))).toContain('Fundamentals');
      expect(tile('Strategist Guides').querySelectorAll('.heroes img').length).toBeGreaterThan(0);
    });

    it('draws no word in the glossary preview that has no data yet', () => {
      expect(flat(tile('Glossary').querySelector('.preview'))).toBe('');
    });
  });

  it('fills the glossary preview from the site data once it arrives', async () => {
    render();
    await answerGlossary([TERM]);

    expect(flat(tile('Glossary').querySelector('.word'))).toBe('Dive');
    expect(flat(tile('Glossary').querySelector('.definition'))).toBe(TERM.definition);
  });

  it('keeps the preview images decorative and out of the accessibility tree', async () => {
    render();
    await answerGlossary([TERM]);

    for (const image of Array.from(element.querySelectorAll('img'))) {
      expect(image.getAttribute('alt')).toBe('');
    }

    for (const preview of Array.from(element.querySelectorAll('.preview'))) {
      expect(preview.getAttribute('aria-hidden')).toBe('true');
    }

    expect(tile('Glossary').querySelectorAll('a').length).toBe(1);
  });

  it('still shows every tile, with no word, when the data cannot be loaded', async () => {
    render();
    await answerGlossary('error');

    expect(element.querySelectorAll('app-hub-tile').length).toBe(links.length);
    expect(flat(tile('Glossary').querySelector('.preview'))).toBe('');
    expect(flat(tile('Glossary').querySelector('.description'))).not.toBe('');
    expect(tile('Glossary').querySelector('.chip')).not.toBeNull();
    expect(element.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it('shows no word when the data is there but empty', async () => {
    render();
    await answerGlossary([]);

    expect(flat(tile('Glossary').querySelector('.preview'))).toBe('');
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
