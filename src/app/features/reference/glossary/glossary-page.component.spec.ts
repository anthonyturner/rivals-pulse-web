import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { GlossaryPageComponent } from './glossary-page.component';
import { GlossaryTerm } from './glossary.model';

const term = (id: string, name: string, overrides: Partial<GlossaryTerm> = {}): GlossaryTerm => ({
  id,
  term: name,
  category: 'Combat',
  definition: `${name} is a thing players say.`,
  coachNote: `Coach note for ${name}.`,
  example: `Example for ${name}.`,
  relatedTerms: [],
  sourceName: 'Marvel Rivals Wiki',
  sourceUrl: `https://example.test/${id}`,
  ...overrides,
});

const TERMS: GlossaryTerm[] = [
  term('wood', '#wood players need cas to get dope', { category: 'Heard In Game' }),
  term('anchor-hero', 'Anchor Hero', {
    category: 'Team-Up',
    definition: 'The hero required for a Team-Up to become active.',
    relatedTerms: ['Team-Up', 'Secondary Hero'],
  }),
  term('dive', 'Dive', { definition: 'A coordinated attack where heroes jump on a vulnerable target.', relatedTerms: ['Flank'] }),
  term('flank', 'Flank', { definition: 'Attack from behind.' }),
  term('gg', 'gg', { category: 'Gaming Chat', definition: 'Good game. Often said to a team that dived well.' }),
  term('team-up', 'Team-Up', {
    category: 'Team-Up',
    definition: 'Two heroes that unlock a shared ability.',
    sourceName: 'Manual seed data',
    sourceUrl: '/glossary',
  }),
];

describe('GlossaryPageComponent', () => {
  let harness: RouterTestingHarness;
  let page: HTMLElement;
  let http: HttpTestingController;

  async function open(url = '/glossary', respond: 'terms' | 'error' | 'none' = 'terms'): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'glossary', component: GlossaryPageComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, GlossaryPageComponent);
    page = harness.routeNativeElement as HTMLElement;

    if (respond === 'terms') {
      http.expectOne('/api/glossary').flush(TERMS);
    } else if (respond === 'error') {
      http.expectOne('/api/glossary').flush('no', { status: 500, statusText: 'Server Error' });
    }
    await settle();
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Types into the search field, then waits past the pause after which the status line is rewritten. */
  async function type(text: string, { wait = true } = {}): Promise<void> {
    const input = page.querySelector<HTMLInputElement>('input[type="search"]') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();

    if (wait) {
      await new Promise((resolve) => setTimeout(resolve, 450));
      await settle();
    }
  }

  async function pickCategory(label: string): Promise<void> {
    const select = page.querySelector<HTMLSelectElement>('select') as HTMLSelectElement;
    const option = Array.from(select.options).find((candidate) => candidate.text === label);
    select.value = option?.value ?? '';
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  const text = (selector: string): string => (page.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const status = (): string => text('[role="status"]');
  const termIds = (): string[] => Array.from(page.querySelectorAll('li.guide-tile')).map((row) => row.id);
  const letters = (): string[] => Array.from(page.querySelectorAll('#letters a')).map((link) => link.textContent?.trim() ?? '');
  const button = (id: string): HTMLButtonElement => page.querySelector<HTMLButtonElement>(`#term-${id}`) as HTMLButtonElement;
  const details = (id: string): HTMLElement => page.querySelector<HTMLElement>(`#details-${id}`) as HTMLElement;

  afterEach(() => http.verify());

  describe('page structure', () => {
    beforeEach(() => open());

    it('has no main or banner of its own, and one h1', () => {
      expect(page.querySelectorAll('main').length).toBe(0);
      expect(page.querySelectorAll('h1').length).toBe(1);
      expect(page.querySelectorAll('header > header').length).toBe(0);
    });

    it('has a letter h2 for each group and an h3 for each term, and no Coach note or Example headings', () => {
      expect(Array.from(page.querySelectorAll('h2')).map((heading) => heading.textContent?.trim())).toEqual(['A', 'D', 'F', 'G', 'T', '#']);
      expect(page.querySelectorAll('h3').length).toBe(TERMS.length);
      expect(Array.from(page.querySelectorAll('h3, h4')).some((heading) => /coach note|example/i.test(heading.textContent ?? ''))).toBeFalse();
    });

    it('has exactly one live region', () => {
      expect(page.querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
    });

    it('shows a labelled search field and a Category select with All categories first', () => {
      expect(page.querySelector('label.guide-search')?.textContent).toContain('Search glossary');
      expect(page.querySelector('[role="search"]')).toBeTruthy();
      expect(text('app-filter-select label')).toContain('Category');

      const labels = Array.from(page.querySelectorAll('select option')).map((option) => option.textContent?.trim());

      expect(labels).toEqual(['All categories', 'Combat', 'Gaming Chat', 'Heard In Game', 'Team-Up']);
    });

    it('starts with every term collapsed, its full definition still in the page', () => {
      for (const row of TERMS) {
        expect(button(row.id).getAttribute('aria-expanded')).toBe('false');
        expect(details(row.id).hidden).toBeTrue();
      }
      expect(page.textContent).toContain('A coordinated attack where heroes jump on a vulnerable target.');
    });
  });

  describe('letters', () => {
    beforeEach(() => open());

    it('lists the letters present, "#" last, each named for assistive technology', () => {
      expect(letters()).toEqual(['A', 'D', 'F', 'G', 'T', '#']);
      expect(page.querySelector('nav#letters')?.getAttribute('aria-label')).toBe('Jump to a letter');
      expect(page.querySelectorAll('#letters a')[0].getAttribute('aria-label')).toBe('Terms starting with A');
      expect(page.querySelectorAll('#letters a')[5].getAttribute('aria-label')).toBe('Terms starting with a symbol or number');
    });

    it('gives each letter heading a Back to A–Z link that moves focus to the first letter link', async () => {
      const back = Array.from(page.querySelectorAll<HTMLAnchorElement>('a')).filter((link) => link.textContent?.trim() === 'Back to A–Z');

      expect(back.length).toBe(6);
      back[3].click();
      await settle();

      expect(document.activeElement).toBe(page.querySelector('#letters a'));
    });

    it('hides the nav, and the back links, when fewer than two letters are listed', async () => {
      await type('behind');

      expect(letters()).toEqual([]);
      expect(Array.from(page.querySelectorAll('a')).some((link) => link.textContent?.includes('Back to A–Z'))).toBeFalse();
    });

    it('moves focus to a letter heading when its link is used', async () => {
      page.querySelectorAll<HTMLAnchorElement>('#letters a')[1].click();
      await settle();

      expect(document.activeElement).toBe(page.querySelector('#letter-d'));
    });
  });

  describe('search and the status line', () => {
    beforeEach(() => open());

    it('starts by counting every term', () => {
      expect(status()).toBe('6 terms');
    });

    it('matches the term, the definition and related terms, and reads "N terms match"', async () => {
      await type('dive');

      expect(termIds()).toEqual(['dive', 'gg']);
      expect(status()).toBe('2 terms match “dive”');
    });

    it('gives the same results for any case and for surrounding spaces', async () => {
      await type('DIVE');
      const upper = termIds();
      await type('  dive  ');

      expect(termIds()).toEqual(upper);
      expect(status()).toBe('2 terms match “dive”');
    });

    it('finds Team-Up from "team up"', async () => {
      await type('team up');

      expect(termIds()).toContain('team-up');
      expect(termIds()).toContain('anchor-hero');
    });

    it('reads "1 term matches" for a single match, and names the category when one is chosen', async () => {
      await type('behind');

      expect(status()).toBe('1 term matches “behind”');

      await type('');
      await pickCategory('Gaming Chat');
      await type('gg');

      expect(status()).toBe('1 term in Gaming Chat matches “gg”');
    });

    it('lists by category alone', async () => {
      await pickCategory('Team-Up');

      expect(termIds()).toEqual(['anchor-hero', 'team-up']);
      expect(status()).toBe('2 terms in Team-Up');
    });

    it('leaves the status line alone while typing, then rewrites it once typing pauses', async () => {
      await type('di', { wait: false });
      await type('div', { wait: false });

      expect(status()).toBe('6 terms');
      expect(termIds()).toEqual(['dive', 'gg']);

      await new Promise((resolve) => setTimeout(resolve, 450));
      await settle();

      expect(status()).toBe('2 terms match “div”');
    });
  });

  describe('no results', () => {
    beforeEach(async () => {
      await open();
      await type('xyzzy');
    });

    it('says so in the one status line, with no letter nav', () => {
      expect(status()).toBe('No terms match “xyzzy”');
      expect(letters()).toEqual([]);
      expect(termIds()).toEqual([]);
    });

    it('shows a silent panel with advice, so the message is not announced twice', () => {
      const panel = page.querySelector('app-state-panel');

      expect(panel?.textContent).toContain('Try fewer letters or a different spelling');
      expect(panel?.getAttribute('role')).toBeNull();
      expect(page.querySelectorAll('[role="status"]').length).toBe(1);
    });

    it('restores every term from "Clear search and filters" and returns focus to the search field', async () => {
      const clear = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((candidate) =>
        candidate.textContent?.includes('Clear search and filters'),
      );
      clear?.click();
      await settle();

      expect(termIds().length).toBe(TERMS.length);
      expect(status()).toBe('6 terms');
      expect(document.activeElement).toBe(page.querySelector('input[type="search"]'));
      expect((document.activeElement as HTMLInputElement).value).toBe('');
    });
  });

  describe('a term row', () => {
    beforeEach(() => open());

    it('opens on its button and shows the coach note, example, category and source', async () => {
      button('anchor-hero').click();
      await settle();

      expect(button('anchor-hero').getAttribute('aria-expanded')).toBe('true');
      expect(button('anchor-hero').getAttribute('aria-controls')).toBe('details-anchor-hero');
      expect(details('anchor-hero').hidden).toBeFalse();

      const labels = Array.from(details('anchor-hero').querySelectorAll('dt')).map((label) => label.textContent?.trim());

      expect(labels).toEqual(['Coach note', 'Example', 'See also', 'Category', 'Source']);
    });

    it('closes again, and keeps an open row open when the filter changes but still lists it', async () => {
      button('dive').click();
      await settle();
      await type('dive');

      expect(button('dive').getAttribute('aria-expanded')).toBe('true');
      expect(button('gg').getAttribute('aria-expanded')).toBe('false');

      button('dive').click();
      await settle();

      expect(details('dive').hidden).toBeTrue();
    });

    it('links a see-also name that is a term here, and leaves the rest as text', () => {
      const links = Array.from(details('anchor-hero').querySelectorAll('dd a')).map((link) => link.textContent?.trim());

      expect(links).toContain('Team-Up');
      expect(links).not.toContain('Secondary Hero');
      expect(details('anchor-hero').textContent).toContain('Secondary Hero');
    });

    it('links the source in a new tab, saying so for assistive technology', () => {
      const link = details('dive').querySelector<HTMLAnchorElement>('a[target="_blank"]') as HTMLAnchorElement;

      expect(link.href).toBe('https://example.test/dive');
      expect(link.rel).toContain('noopener');
      expect(link.querySelector('.visually-hidden')?.textContent).toContain('opens in a new tab');
    });

    it('shows the source as plain text, not a link, when it is a page of this site', async () => {
      button('team-up').click();
      await settle();

      expect(details('team-up').querySelector('a[target="_blank"]')).toBeNull();
      expect(details('team-up').textContent).toContain('Manual seed data');
    });

    it('opens and focuses the term a see-also link names', async () => {
      const link = Array.from(details('anchor-hero').querySelectorAll<HTMLAnchorElement>('dd a')).find(
        (candidate) => candidate.textContent?.trim() === 'Team-Up',
      );
      link?.click();
      await settle();

      expect(button('team-up').getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(button('team-up'));
    });
  });

  describe('loading, failure and an empty glossary', () => {
    it('says it is loading until the terms arrive', async () => {
      await open('/glossary', 'none');

      expect(status()).toBe('Loading the glossary…');

      http.expectOne('/api/glossary').flush(TERMS);
      await settle();

      expect(status()).toBe('6 terms');
    });

    it('reports a failed request as a failure, not as an empty glossary, and offers Try again', async () => {
      await open('/glossary', 'error');

      expect(status()).toBe('The glossary could not be loaded.');
      expect(page.querySelectorAll('[role="status"]').length).toBe(1);
      expect(text('app-state-panel')).toContain('Try again');
      expect(page.textContent).not.toContain('No terms');

      Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find((candidate) => candidate.textContent?.includes('Try again'))?.click();
      await settle();

      expect(status()).toBe('Loading the glossary…');

      http.expectOne('/api/glossary').flush(TERMS);
      await settle();

      expect(status()).toBe('6 terms');
      expect(termIds().length).toBe(TERMS.length);
    });

    it('says when the glossary truly has no terms', async () => {
      await open('/glossary', 'none');
      http.expectOne('/api/glossary').flush([]);
      await settle();

      expect(status()).toBe('The glossary has no terms yet.');
      expect(page.querySelectorAll('[role="status"]').length).toBe(1);
    });
  });

  describe('deep links', () => {
    it('opens a term, and focuses its button, on a cold load', async () => {
      await open('/glossary#anchor-hero');

      expect(button('anchor-hero').getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(button('anchor-hero'));
      expect(page.querySelector('app-notice')).toBeNull();
    });

    it('clears a search that hides the term first', async () => {
      await open('/glossary');
      await type('zzz');
      await harness.navigateByUrl('/glossary#anchor-hero');
      await settle();

      expect((page.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('');
      expect(termIds().length).toBe(TERMS.length);
      expect(document.activeElement).toBe(button('anchor-hero'));
      expect(status()).toBe('6 terms');
    });

    it('focuses a letter heading', async () => {
      await open('/glossary#letter-d');

      expect(document.activeElement).toBe(page.querySelector('#letter-d'));
    });

    it('shows a notice, and nothing else changes, for an id that is not a term', async () => {
      await open('/glossary#nope');

      expect(text('app-notice')).toBe('That term is not in the glossary.');
      expect(page.querySelector('app-notice p')?.getAttribute('role')).toBe('note');
      expect(termIds().length).toBe(TERMS.length);
      expect(page.querySelectorAll('[role="status"]').length).toBe(1);
    });

    it('does not count the A to Z nav as an unknown id', async () => {
      await open('/glossary#letters');

      expect(page.querySelector('app-notice')).toBeNull();
      expect(document.activeElement).toBe(page.querySelector('#letters a'));
    });
  });
});
