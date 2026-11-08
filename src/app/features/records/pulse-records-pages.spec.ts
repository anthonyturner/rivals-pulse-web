import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { PulseRecords } from '../../../contracts/pulse-records.model';
import { routes } from '../../app.routes';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { heroOf } from '../insights/hero-matchup.fixtures';
import { RecordsCategoryPageComponent } from './records-category-page/records-category-page.component';
import { RecordsPageComponent } from './records-page/records-page.component';
import { recordRows, recordsOf } from './pulse-records.fixtures';

const ROSTER = [heroOf('hulk', 'Hulk', 'Vanguard'), heroOf('storm', 'Storm', 'Duelist')];

describe('the Pulse Records pages', () => {
  let http: HttpTestingController;
  const response = { status: 200 };

  beforeEach(() => {
    response.status = 200;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: RESPONSE_INIT, useValue: response },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /** Opens an address, answers its two requests, and returns the page's element. */
  async function open(url: string, answer: PulseRecords | 'failure'): Promise<{ element: HTMLElement; component: unknown }> {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url);

    http.expectOne('/api/heroes').flush(ROSTER);

    const request = http.expectOne('/api/records');

    if (answer === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(answer);
    }

    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');

    return { element, component };
  }

  const text = (element: Element): string => (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  const cells = (row: Element): string[] => Array.from(row.children).map(text);
  const allBoards = recordsOf({
    kills: recordRows(12, 60),
    assists: recordRows(6, 50),
    final_hits: recordRows(5, 30),
    damage: recordRows(5, 31250),
    healing: recordRows(5, 40000),
    blocked: recordRows(5, 30000),
  });

  describe('/records', () => {
    it('shows the six boards with five rows each, and no time, select or match link', async () => {
      const { element, component } = await open('/records', allBoards);

      expect(component).toBeInstanceOf(RecordsPageComponent);
      expect(Array.from(element.querySelectorAll('h2')).map(text).slice(0, 6)).toEqual([
        'Kills',
        'Assists',
        'Final Hits',
        'Damage',
        'Healing',
        'Damage Blocked',
      ]);

      const tables = Array.from(element.querySelectorAll('table'));

      expect(tables.length).toBe(6);
      expect(tables.map((table) => table.querySelectorAll('tbody tr').length)).toEqual([5, 5, 5, 5, 5, 5]);
      expect(element.querySelector('time')).toBeNull();
      expect(element.querySelector('select')).toBeNull();
      expect(element.querySelector('a[href*="match"]')).toBeNull();
    });

    it('draws a hero, a player or "Anonymous", and the figure on each row', async () => {
      const { element } = await open('/records', allBoards);
      const first = element.querySelector('tbody tr') as HTMLElement;
      const second = element.querySelectorAll('tbody tr')[1] as HTMLElement;

      expect(cells(first)).toEqual(['1', 'Hulk', 'Anonymous', '60']);
      expect(cells(second)).toEqual(['2', 'Storm', 'Player 1', '59']);
      expect(first.querySelector('img')).toBeTruthy();
    });

    it('links each board to its own page', async () => {
      const { element } = await open('/records', allBoards);
      const hrefs = Array.from(element.querySelectorAll('a.more')).map((link) => link.getAttribute('href'));

      expect(hrefs).toEqual([
        '/records/kills',
        '/records/assists',
        '/records/final-hits',
        '/records/damage',
        '/records/healing',
        '/records/damage-blocked',
      ]);
    });

    it('says where the records come from, what the figures cover and the date from the data', async () => {
      const { element } = await open('/records', allBoards);
      const page = text(element);

      expect(page).toContain('Matches since September 20, 2026');
      expect(page).toContain('Records come only from matches the Rivals Pulse desktop app uploaded');
      expect(page).toContain("Damage, healing and damage blocked come only from the uploader's own line");
      expect(page).toContain('each figure is the best on one hero in one match, not a total across heroes');
      expect(page).toContain('For kills, assists and final hits the hero is the one the game recorded');
    });

    it('holds back a board with fewer than two rows and keeps the others', async () => {
      const { element } = await open('/records', recordsOf({ kills: recordRows(7), assists: recordRows(1) }));
      const boards = Array.from(element.querySelectorAll('section.board'));

      expect(boards.length).toBe(6);
      expect(boards[0].querySelectorAll('tbody tr').length).toBe(5);
      expect(cells(boards[1])).toEqual(['Assists', 'Not enough data yet.']);
      expect(element.querySelectorAll('table').length).toBe(1);
    });

    it('says there is not enough data yet when no board has enough rows, without a date', async () => {
      const { element } = await open('/records', recordsOf({ kills: recordRows(1) }));

      expect(element.querySelector('table')).toBeNull();
      expect(text(element)).toContain('Not enough data yet');
      expect(text(element)).toContain('A list is shown from 2 different uploading players');
      expect(text(element)).not.toContain('Matches since');
      expect(element.querySelector('app-records-coverage')).toBeTruthy();
    });

    it('says so when the records cannot be loaded', async () => {
      const { element } = await open('/records', 'failure');

      expect(element.querySelector('[role="status"]')?.textContent).toContain('Pulse Records could not be loaded');
      expect(element.querySelector('table')).toBeNull();
    });

    it('says it is loading, without announcing it', async () => {
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/records');
      harness.detectChanges();

      const element = harness.routeNativeElement as HTMLElement;

      expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading Pulse Records');
      expect(element.querySelector('[role="status"]')).toBeNull();
      http.expectOne('/api/heroes');
      http.expectOne('/api/records');
    });
  });

  describe('/records/:category', () => {
    it('shows one board in full, up to 50 rows', async () => {
      const { element, component } = await open('/records/kills', recordsOf({ kills: recordRows(50, 90) }));

      expect(component).toBeInstanceOf(RecordsCategoryPageComponent);
      expect(text(element.querySelector('h1') as Element)).toBe('Most kills in one match');
      expect(element.querySelectorAll('tbody tr').length).toBe(50);
      expect(element.querySelector('time')).toBeNull();
      expect(element.querySelector('select')).toBeNull();
      expect(text(element)).toContain('Matches since September 20, 2026');
    });

    it('uses the readable address of a board whose name has two words', async () => {
      const { element } = await open('/records/damage-blocked', recordsOf({ blocked: recordRows(8, 30000) }));

      expect(text(element.querySelector('h1') as Element)).toBe('Most damage blocked on one hero in one match');
      expect(element.querySelector('th.value')?.textContent).toContain('Damage Blocked');
      expect(element.querySelectorAll('tbody tr').length).toBe(8);
    });

    it('titles the tab after the list', async () => {
      await open('/records/final-hits', allBoards);

      expect(TestBed.inject(Title).getTitle()).toBe('Pulse Records: Final Hits | RivalsPulse');
    });

    it('links to the other lists and marks the current one', async () => {
      const { element } = await open('/records/final-hits', allBoards);
      const current = element.querySelector('nav a[aria-current="page"]');

      expect(text(current as Element)).toBe('Final Hits');
      expect(element.querySelectorAll('nav a').length).toBe(7);
    });

    it('says there is not enough data yet for a thin board', async () => {
      const { element } = await open('/records/healing', recordsOf({ healing: recordRows(1), kills: recordRows(9) }));

      expect(element.querySelector('table')).toBeNull();
      expect(text(element)).toContain('Not enough data yet');
      expect(text(element)).toContain('This list appears once 2 different uploading players have a record for it');
      expect(text(element)).not.toContain('Matches since');
      expect(element.querySelector('app-state-panel a[href="/records"]')?.textContent).toBe('other records');
      expect(element.querySelector('app-records-coverage')).toBeTruthy();
    });

    it('says so when the records cannot be loaded', async () => {
      const { element } = await open('/records/kills', 'failure');

      expect(element.querySelector('[role="status"]')?.textContent).toContain('Pulse Records could not be loaded');
      expect(element.querySelector('table')).toBeNull();
    });

    it('says it is loading under the list links, without announcing it', async () => {
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/records/kills');
      harness.detectChanges();

      const element = harness.routeNativeElement as HTMLElement;

      expect(element.querySelectorAll('nav a').length).toBe(7);
      expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading Pulse Records');
      expect(element.querySelector('[role="status"]')).toBeNull();
      http.expectOne('/api/heroes');
      http.expectOne('/api/records');
    });

    it('shows the 404 page for an unknown category and answers 404', async () => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl('/records/speed');

      expect(component).toBeInstanceOf(NotFoundComponent);
      expect(TestBed.inject(Router).url).toBe('/records/speed');
      expect(response.status).toBe(404);
    });
  });
});
