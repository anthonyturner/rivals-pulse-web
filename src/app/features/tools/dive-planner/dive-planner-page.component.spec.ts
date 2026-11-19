import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { Hero } from '../../heroes/hero.model';
import { heroOf, matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import { DivePlannerPageComponent } from './dive-planner-page.component';

const roster = [
  heroOf('angela', 'Angela', 'Vanguard'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('spider-man', 'Spider-Man', 'Duelist'),
  heroOf('peni-parker', 'Peni Parker', 'Vanguard'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('psylocke', 'Psylocke', 'Duelist'),
  heroOf('magik', 'Magik', 'Duelist'),
];

describe('DivePlannerPageComponent', () => {
  let fixture: ComponentFixture<DivePlannerPageComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DivePlannerPageComponent],
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
    fixture = TestBed.createComponent(DivePlannerPageComponent);
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
  const answersStep = '.steps > section:last-child';
  const liveRegions = (root: ParentNode): NodeListOf<Element> =>
    root.querySelectorAll('[aria-live], [role="status"], [role="alert"]');
  const click = async (button: Element | null | undefined): Promise<void> => {
    (button as HTMLButtonElement).click();
    await fixture.whenStable();
  };

  const partial = matchupsOf([
    matchup('peni-parker', 'angela', 10, 12),
    matchup('peni-parker', 'black-cat', 9, 12),
    matchup('mantis', 'black-cat', 9, 12),
    matchup('angela', 'mantis', 8, 11),
    matchup('angela', 'peni-parker', 2, 12),
  ]);

  describe('landmarks', () => {
    it('is one page wrapper that leaves the main landmark to the shell, with a page header', async () => {
      const root = await open(matchupsOf([]));

      expect(root.querySelector('div.planner.page-container--wide')).not.toBeNull();
      expect(root.querySelector('main')).toBeNull();
      expect(text(root, 'app-page-header h1')).toBe('Dive Response Planner');
    });

    it('keeps one live region when the matchups are ready', async () => {
      expect(liveRegions(await open(partial)).length).toBe(1);
    });

    it('keeps one live region when there are no matchups yet', async () => {
      expect(liveRegions(await open(matchupsOf([]))).length).toBe(1);
    });

    it('keeps one live region when the matchups cannot be read', async () => {
      expect(liveRegions(await open(500)).length).toBe(1);
    });

    it('keeps one live region while everything loads', async () => {
      expect(liveRegions(await open('pending', 'pending')).length).toBe(1);
    });
  });

  describe('while the data loads', () => {
    it('shows no chips before the roster arrives', async () => {
      const root = await open(matchupsOf([]), 'pending');

      expect(root.querySelectorAll('.chip').length).toBe(0);
      expect(text(root, '.steps')).not.toContain('Select at least one enemy threat.');
    });

    it('shows a loading panel and no answers while the matchups load', async () => {
      const root = await open('pending');

      expect(root.querySelector(`${answersStep} [aria-busy="true"]`)?.textContent).toContain('Loading matchups');
      expect(root.querySelectorAll('.tiles .pick').length).toBe(0);
    });
  });

  describe('when no matchup qualifies yet', () => {
    it('shows one designed empty state with no NaN', async () => {
      const root = await open(matchupsOf([]));

      expect(text(root, answersStep)).toContain('Not enough data yet');
      expect(text(root, answersStep)).toContain('No two heroes have faced each other in 10 recorded matches yet');
      expect(root.querySelectorAll('.tiles').length).toBe(0);
      expect(root.textContent).not.toMatch(/NaN|\b0\.0%|Infinity|undefined/);
    });
  });

  describe('when the matchups cannot be read', () => {
    it('says so in the answers, announces it once, and keeps the threat chips', async () => {
      const root = await open(500);

      expect(text(root, answersStep)).toContain('Matchups unavailable');
      expect(text(root, '[aria-live]')).toBe(
        'RivalsPulse player matchups cannot be loaded right now. The threat chips still work.',
      );
      expect(root.querySelectorAll('.chip').length).toBeGreaterThan(0);
      expect(root.textContent).not.toMatch(/NaN|Infinity/);
    });
  });

  describe('with some matchups', () => {
    it('tells which heroes do better than usual against several of the chosen threats', async () => {
      const root = await open(partial);

      expect(names(root, answersStep)).toEqual(['Peni Parker', 'Mantis']);
      expect(text(root, answersStep)).toContain('Does better than usual against Angela, Black Cat');
      expect(text(root, answersStep)).toContain('2/3');
    });

    it('links each answer to that hero on the Counters page', async () => {
      const root = await open(partial);

      expect([...root.querySelectorAll(`${answersStep} a.pick`)].map((link) => link.getAttribute('href'))).toEqual([
        '/counters?hero=peni-parker',
        '/counters?hero=mantis',
      ]);
    });

    it('announces the chosen count and the number of answers', async () => {
      const root = await open(partial);

      expect(text(root, '[aria-live]')).toBe('3 of 4 chosen. 2 heroes that do better than usual.');
    });

    it('shows the empty line, not an error, when the threats chosen have no winning answer yet', async () => {
      const root = await open(partial);

      await click(root.querySelectorAll('.chip[aria-pressed="true"]')[0]);
      await click(root.querySelectorAll('.chip[aria-pressed="true"]')[0]);

      expect(names(root, answersStep)).toEqual([]);
      expect(text(root, answersStep)).toContain('No hero stands out yet');
      expect(text(root, answersStep)).not.toContain('Not enough data yet');
    });

    it('asks for a threat when none is chosen', async () => {
      const root = await open(partial);

      for (const chip of Array.from(root.querySelectorAll('.chip[aria-pressed="true"]'))) {
        await click(chip);
      }

      expect(text(root, '.steps')).toContain('Select at least one enemy threat.');
      expect(text(root, '.chips + .detail')).toContain('0 of 4 chosen');
      expect(text(root, '[aria-live]')).toBe('0 of 4 chosen');
    });

    it('drops the oldest threat when a fifth is chosen', async () => {
      const root = await open(partial);

      await click(root.querySelectorAll('.chip[aria-pressed="false"]')[0]);
      await click(root.querySelectorAll('.chip[aria-pressed="false"]')[0]);

      expect(root.querySelectorAll('.chip[aria-pressed="true"]').length).toBe(4);
      expect(root.querySelector('.chip[aria-pressed="true"]')?.textContent).not.toContain('Angela');
    });

    it('labels the previous half-season when it stands in for the current one', async () => {
      const root = await open({ ...partial, halfSeason: season(10), inPlaceOf: season(10.5) });

      expect(text(root, '.source')).toContain('Half-season: Season 10');
      expect(text(root, 'app-notice')).toContain(
        "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
      );
    });
  });

  describe('what the page does not say', () => {
    it('describes records and never orders heroes to ban', async () => {
      const root = await open(partial);

      expect(root.textContent).not.toMatch(/\bban\b|\bbans\b|banned|\bban order\b/i);
    });

    it('keeps the Jubilee case study closed until it is opened', async () => {
      const root = await open(matchupsOf([]));

      expect(text(root, 'app-jubilee-case-study summary')).toBe('Jubilee case study');
      expect(root.querySelector('app-jubilee-case-study details')?.hasAttribute('open')).toBeFalse();
    });
  });
});
