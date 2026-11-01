import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { killPair, killsOf } from '../../insights/community-extended.fixtures';
import { heroOf, matchup, matchupsOf } from '../../insights/hero-matchup.fixtures';
import { CountersTabComponent } from './counters-tab.component';

const READY = matchupsOf([
  matchup('hulk', 'thor', 9, 12),
  matchup('thor', 'hulk', 3, 12),
  matchup('storm', 'thor', 11, 12),
]);

const KILLS_READY = killsOf([killPair('storm', 'hulk', 100), killPair('thor', 'storm', 25)]);

describe('CountersTabComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<CountersTabComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';
  const matchupsPanel = (): HTMLElement => host().querySelector('app-community-summary') as HTMLElement;
  const killFeedPanel = (): HTMLElement => host().querySelector('.counters-tab__kill-feed') as HTMLElement;

  async function answer(matchups: unknown, status = 200, kills: unknown = KILLS_READY): Promise<void> {
    http.expectOne('/api/community/kills').flush(kills as object);
    http
      .expectOne('/api/heroes')
      .flush([heroOf('hulk', 'Hulk', 'Vanguard'), heroOf('thor', 'Thor', 'Vanguard'), heroOf('storm', 'Storm', 'Duelist')]);
    http
      .expectOne('/api/hero-matchups')
      .flush(matchups as object, { status, statusText: status === 200 ? 'OK' : 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CountersTabComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading while the requests run', async () => {
    expect(host().querySelector('[role="status"]')?.textContent).toContain('Loading');
    await answer(READY);
  });

  it('lists the strongest winning records, strongest first, and links to the counters tool', async () => {
    await answer(READY);

    const rows = Array.from(matchupsPanel().querySelectorAll('li')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim());

    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Storm wins against Thor');
    expect(rows[0]).toContain('91.7%');
    expect(rows[1]).toContain('Hulk wins against Thor');
    expect(rows[1]).toContain('12 matches');
    expect(text()).not.toMatch(/NaN|undefined|null/);
    expect(Array.from(matchupsPanel().querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'))).toContain('/counters');
  });

  it('shows the designed empty state, with the minimum named, when no pairing has enough matches', async () => {
    await answer(matchupsOf([]));

    expect(matchupsPanel().querySelector('.empty-state')).toBeTruthy();
    expect(matchupsPanel().textContent).toContain('10 recorded matches');
    expect(matchupsPanel().querySelector('a')?.getAttribute('href')).toBe('/counters');
  });

  it('says the matchups cannot be loaded when the request fails, and shows no empty state', async () => {
    await answer('down', 500);

    expect(matchupsPanel().textContent).toContain('cannot be loaded right now');
    expect(host().querySelector('.empty-state')).toBeNull();
  });

  describe('the kill feed', () => {
    it('lists the pairs with the most seen kills as bands, labelled as a separate measure', async () => {
      await answer(READY);

      const rows = Array.from(killFeedPanel().querySelectorAll('li')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim());

      expect(rows).toEqual(['Storm was seen killing Hulk 100+ seen kills', 'Thor was seen killing Storm 25+ seen kills']);
      expect(killFeedPanel().textContent).toContain('A separate measure from the matchup records');
      expect(killFeedPanel().textContent).toContain('miss kills that player did not see');
      expect(killFeedPanel().textContent).not.toMatch(/NaN|undefined|null/);
    });

    it('shows its own designed empty state, naming the minimums, while the matchups are ready', async () => {
      await answer(READY, 200, killsOf([]));

      expect(matchupsPanel().querySelectorAll('li').length).toBe(2);
      expect(killFeedPanel().querySelector('.empty-state')).toBeTruthy();
      expect(killFeedPanel().textContent).toContain('10 recorded matches');
      expect(killFeedPanel().textContent).toContain('at least 3 different players');
    });

    it('says only itself cannot be loaded when its request fails', async () => {
      await answer(READY, 200, 'down');

      expect(killFeedPanel().textContent).toContain('cannot be loaded right now');
      expect(matchupsPanel().querySelectorAll('li').length).toBe(2);
    });
  });
});
