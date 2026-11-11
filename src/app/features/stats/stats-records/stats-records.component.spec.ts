import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { PulseRecords } from '../../../../contracts/pulse-records.model';
import { ThinContent } from '../../../core/seo/thin-content';
import { heroOf } from '../../insights/hero-matchup.fixtures';
import { recordRows, recordsOf } from '../../records/pulse-records.fixtures';
import { StatsRecordsComponent } from './stats-records.component';

const ROSTER = [heroOf('hulk', 'Hulk', 'Vanguard'), heroOf('storm', 'Storm', 'Duelist')];

const ALL_BOARDS = recordsOf({
  kills: recordRows(12, 60),
  assists: recordRows(6, 50),
  final_hits: recordRows(5, 30),
  damage: recordRows(5, 31250),
  healing: recordRows(5, 40000),
  blocked: recordRows(5, 30000),
});

describe('The Stats hub Records tab', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  const element = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const text = (node: Element | null): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const select = (): HTMLSelectElement => element().querySelector('select') as HTMLSelectElement;
  const headings = (): string[] => Array.from(element().querySelectorAll('h2')).map(text);
  const rowCounts = (): number[] =>
    Array.from(element().querySelectorAll('table')).map((table) => table.querySelectorAll('tbody tr').length);

  async function open(url: string, answer: PulseRecords | 'failure'): Promise<void> {
    await harness.navigateByUrl(url, StatsRecordsComponent);

    http.expectOne('/api/heroes').flush(ROSTER);

    const request = http.expectOne('/api/records');

    if (answer === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(answer);
    }

    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function choose(value: string): Promise<void> {
    select().value = value;
    select().dispatchEvent(new Event('change'));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'stats/records', component: StatsRecordsComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  describe('with no category chosen', () => {
    beforeEach(() => open('/stats/records', ALL_BOARDS));

    it('offers every list in one filter, with All records first and chosen', () => {
      const options = Array.from(select().options);

      expect(options.map((option) => text(option))).toEqual([
        'All records',
        'Kills',
        'Assists',
        'Final Hits',
        'Damage',
        'Healing',
        'Damage Blocked',
      ]);
      expect(options.map((option) => option.value)).toEqual([
        '',
        'kills',
        'assists',
        'final-hits',
        'damage',
        'healing',
        'damage-blocked',
      ]);
      expect(select().value).toBe('');
    });

    it('shows the six boards with five rows each', () => {
      expect(headings().slice(0, 6)).toEqual(['Kills', 'Assists', 'Final Hits', 'Damage', 'Healing', 'Damage Blocked']);
      expect(rowCounts()).toEqual([5, 5, 5, 5, 5, 5]);
    });

    it('links each board to itself alone, in this page, and not to the old lists', () => {
      const hrefs = Array.from(element().querySelectorAll('a.more')).map((link) => link.getAttribute('href'));

      expect(hrefs).toEqual([
        '/stats/records?category=kills',
        '/stats/records?category=assists',
        '/stats/records?category=final-hits',
        '/stats/records?category=damage',
        '/stats/records?category=healing',
        '/stats/records?category=damage-blocked',
      ]);
    });

    it('says where the records come from and the date from the data', () => {
      expect(text(element())).toContain('Matches since September 20, 2026');
      expect(element().querySelector('app-records-coverage')).not.toBeNull();
    });

    it('explains how a list is made, and links to how we count', () => {
      expect(text(element().querySelector('.intro'))).toContain('one line per uploading player');
      expect(element().querySelector('.intro a')?.getAttribute('href')).toBe('/how-we-count');
    });

    it('is not thin content once a board has enough rows', () => {
      expect(TestBed.inject(ThinContent).thin()).toBeFalse();
    });

    it('draws a hero, a player or "Anonymous", and the figure on each row, with no time or match link', () => {
      const rows = element().querySelectorAll('tbody tr');
      const cells = (row: Element): string[] => Array.from(row.children).map((cell) => text(cell));

      expect(cells(rows[0])).toEqual(['1', 'Hulk', 'Anonymous', '60']);
      expect(cells(rows[1])).toEqual(['2', 'Storm', 'Player 1', '59']);
      expect(rows[0].querySelector('img')).not.toBeNull();
      expect(element().querySelector('time')).toBeNull();
      expect(element().querySelector('a[href*="match"]')).toBeNull();
    });
  });

  describe('with a category chosen', () => {
    it('shows that one board in full, up to 50 rows, with no link to open it', async () => {
      await open('/stats/records?category=kills', recordsOf({ kills: recordRows(50, 90), assists: recordRows(6) }));

      expect(headings()[0]).toBe('Kills');
      expect(headings()).not.toContain('Assists');
      expect(rowCounts()).toEqual([50]);
      expect(element().querySelector('a.more')).toBeNull();
      expect(select().value).toBe('kills');
    });

    it('reads a list whose slug differs from its key', async () => {
      await open('/stats/records?category=damage-blocked', ALL_BOARDS);

      expect(headings()[0]).toBe('Damage Blocked');
      expect(rowCounts()).toEqual([5]);
      expect(select().value).toBe('damage-blocked');
    });

    it('treats a category it does not know as all of them', async () => {
      await open('/stats/records?category=nothing', ALL_BOARDS);

      expect(rowCounts()).toEqual([5, 5, 5, 5, 5, 5]);
      expect(select().value).toBe('');
    });

    it('says there is not enough data yet when the chosen list is below its minimum, even if others are not', async () => {
      await open('/stats/records?category=assists', recordsOf({ kills: recordRows(12), assists: recordRows(1) }));

      expect(element().querySelector('table')).toBeNull();
      expect(text(element())).toContain('Not enough data yet');
      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    });
  });

  describe('choosing a category', () => {
    it('puts it in the address and shows that list in full, from the answer already loaded', async () => {
      await open('/stats/records', recordsOf({ kills: recordRows(50, 90), assists: recordRows(6) }));

      await choose('kills');

      expect(TestBed.inject(Router).url).toBe('/stats/records?category=kills');
      expect(rowCounts()).toEqual([50]);
      expect(select().value).toBe('kills');
    });

    it('goes back to all lists, and drops the category from the address, when All records is chosen', async () => {
      await open('/stats/records?category=kills', ALL_BOARDS);

      await choose('');

      expect(TestBed.inject(Router).url).toBe('/stats/records');
      expect(rowCounts()).toEqual([5, 5, 5, 5, 5, 5]);
    });

    it('follows a link to one list without asking the server again', async () => {
      await open('/stats/records', ALL_BOARDS);

      (element().querySelector('a.more') as HTMLAnchorElement).click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Router).url).toBe('/stats/records?category=kills');
      expect(rowCounts()).toEqual([12]);
    });
  });

  describe('when there is nothing to show', () => {
    it('holds back a board with fewer than two rows and keeps the others', async () => {
      await open('/stats/records', recordsOf({ kills: recordRows(7), assists: recordRows(1) }));

      const boards = Array.from(element().querySelectorAll('section.board'));

      expect(boards.length).toBe(6);
      expect(boards[0].querySelectorAll('tbody tr').length).toBe(5);
      expect(text(boards[1].querySelector('h2'))).toBe('Assists');
      expect(text(boards[1].querySelector('.thin'))).toBe('Not enough data yet.');
      expect(element().querySelectorAll('table').length).toBe(1);
    });

    it('says it is loading, without announcing it, while the records are on their way', async () => {
      await harness.navigateByUrl('/stats/records', StatsRecordsComponent);
      harness.detectChanges();

      expect(text(element().querySelector('[aria-busy="true"]'))).toContain('Loading Pulse Records');
      expect(element().querySelector('[role="status"]')).toBeNull();
      http.expectOne('/api/heroes');
      http.expectOne('/api/records');
    });

    it('says so, and is thin content, when no board has enough rows', async () => {
      await open('/stats/records', recordsOf({ kills: recordRows(1) }));

      expect(element().querySelector('table')).toBeNull();
      expect(text(element())).toContain('A list is shown from 2 different uploading players');
      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    });

    it('says so when the records cannot be loaded', async () => {
      await open('/stats/records', 'failure');

      expect(text(element().querySelector('[role="status"]'))).toContain('Pulse Records could not be loaded');
      expect(element().querySelector('table')).toBeNull();
    });
  });
});
