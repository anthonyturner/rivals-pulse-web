import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { heroOf, matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import { CountersPageComponent } from './counters-page.component';

const roster = [
  heroOf('angela', 'Angela', 'Vanguard'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('spider-man', 'Spider-Man', 'Duelist'),
  heroOf('peni-parker', 'Peni Parker', 'Vanguard'),
  heroOf('mantis', 'Mantis', 'Strategist'),
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
    fixture = TestBed.createComponent(CountersPageComponent);
  });

  afterEach(() => http.verify());

  /** Opens the page; `matchups` is what `/api/hero-matchups` answers, or a status code for a failed call. */
  async function open(matchups: HeroMatchups | number | 'pending'): Promise<HTMLElement> {
    fixture.detectChanges();
    http.expectOne('/api/heroes').flush(roster);

    const request = http.expectOne('/api/hero-matchups');
    if (typeof matchups === 'number') {
      request.flush('down', { status: matchups, statusText: 'Server Error' });
    } else if (matchups !== 'pending') {
      request.flush(matchups);
    }

    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, selector: string): string => root.querySelector(selector)?.textContent ?? '';
  const answerNames = (root: HTMLElement): (string | undefined)[] =>
    [...root.querySelectorAll('.overlap-grid .answer-copy strong')].map((name) => name.textContent?.trim());

  describe('when no matchup qualifies yet', () => {
    it('shows the designed empty state in the planner and for the selected hero, with no NaN', async () => {
      const root = await open(matchupsOf([]));
      const page = root.textContent ?? '';

      expect(text(root, '.data-status')).toContain('Not enough data yet');
      expect(text(root, '.data-status')).toContain('No two heroes have faced each other in 10 recorded matches yet');
      expect(text(root, '.overlap-grid')).toContain('Not enough data yet');
      expect(text(root, '.overlap-grid')).toContain('Use the response order below');
      expect(root.querySelectorAll('.counter-board .panel')[0].textContent).toContain('Not enough data yet');
      expect(root.querySelectorAll('.counter-board .panel')[1].textContent).toContain('Not enough data yet');
      expect(answerNames(root)).toEqual([]);
      expect(root.querySelectorAll('.counter-card').length).toBe(0);
      expect(page).not.toMatch(/NaN|\b0\.0%|Infinity|undefined/);
    });

    it('shows "No matchup yet" on every hero tile instead of a count of scraped counters', async () => {
      const root = await open(matchupsOf([]));
      const labels = [...root.querySelectorAll('.hero-tile small')].map((label) => label.textContent?.trim());

      expect(labels).toEqual(roster.map(() => 'No matchup yet'));
    });
  });

  describe('when the matchups cannot be read', () => {
    it('says so in the planner and the panels, and the rest of the page still renders', async () => {
      const root = await open(500);

      expect(text(root, '.data-status')).toContain('cannot be loaded right now');
      expect(text(root, '.overlap-grid')).toContain('Matchups unavailable');
      expect(root.querySelectorAll('.hero-tile').length).toBe(roster.length);
      expect([...root.querySelectorAll('.hero-tile small')].map((label) => label.textContent?.trim())).toEqual(
        roster.map(() => 'Unavailable'),
      );
      expect(root.textContent).not.toMatch(/NaN|Infinity/);
    });
  });

  describe('while the matchups load', () => {
    it('shows a loading line and no cards', async () => {
      const root = await open('pending');

      expect(root.querySelector('.data-status [role="status"]')?.textContent).toContain('Loading');
      expect(root.querySelectorAll('.counter-card').length).toBe(0);
      expect([...root.querySelectorAll('.hero-tile small')].map((label) => label.textContent?.trim())).toEqual(
        roster.map(() => 'Loading'),
      );
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

    it('lists the heroes that beat the selected hero, with their win rate and sample', async () => {
      const root = await open(partial);
      const board = root.querySelectorAll('.counter-board .panel');
      const against = board[0].textContent ?? '';
      const beats = board[1].textContent ?? '';

      expect(text(root, '.selected-profile')).toContain('Angela');
      expect(text(root, '.selected-profile')).toContain('2 matchups');
      expect(against).toContain('Heroes that beat Angela');
      expect(against).toContain('Peni Parker');
      expect(against).toContain('83.3% · 12 matches');
      expect(beats).toContain('Heroes Angela beats');
      expect(beats).toContain('Mantis');
      expect(beats).not.toContain('Peni Parker');
      expect(text(root, '.data-status')).not.toContain('Not enough data yet');
    });

    it('tells the planner which heroes have a winning record against several of the chosen threats', async () => {
      const root = await open(partial);

      expect(answerNames(root)).toEqual(['Peni Parker', 'Mantis']);
      expect(text(root, '.overlap-grid')).toContain('Has a winning record against Angela, Black Cat');
      expect(text(root, '.overlap-grid')).toContain('2/3');
    });

    it('shows the empty line, not an error, when the threats chosen have no winning answer yet', async () => {
      const root = await open(partial);
      fixture.componentInstance.selectedDiveThreatIds.set(['spider-man']);
      await fixture.whenStable();

      expect(answerNames(root)).toEqual([]);
      expect(text(root, '.overlap-grid')).toContain('No winning record yet');
      expect(text(root, '.overlap-grid')).not.toContain('Not enough data yet');
    });

    it('has no numbered badges on the planner and a hero-name-only search', async () => {
      const root = await open(partial);

      expect(root.querySelector('.answer-rank')).toBeNull();
      expect(root.querySelector('input[type="search"]')?.getAttribute('placeholder')).toBe('Hero name');
    });

    it('lists cards by matches, then name', async () => {
      const root = await open(
        matchupsOf([
          matchup('peni-parker', 'angela', 10, 12),
          matchup('mantis', 'angela', 14, 20),
          matchup('black-cat', 'angela', 9, 12),
        ]),
      );
      const names = [...root.querySelectorAll('.counter-board .panel')[0].querySelectorAll('.counter-card strong')].map(
        (name) => name.textContent?.trim(),
      );

      expect(names).toEqual(['Mantis', 'Black Cat', 'Peni Parker']);
    });

    it('lets a card pivot to that hero', async () => {
      const root = await open(partial);

      (root.querySelectorAll('.counter-board .panel')[0].querySelector('.counter-card') as HTMLButtonElement).click();
      await fixture.whenStable();

      expect(text(root, '.selected-profile')).toContain('Peni Parker');
    });

    it('labels the previous half-season when it stands in for the current one', async () => {
      const root = await open({ ...partial, halfSeason: season(10), inPlaceOf: season(10.5) });

      expect(text(root, '.data-status')).toContain('Half-season: Season 10');
      expect(text(root, '.data-status')).toContain(
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
