import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { heroOf } from '../../insights/hero-matchup.fixtures';
import { statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { TierListTabComponent } from './tier-list-tab.component';

const READY = statsOf([
  { name: 'S', heroes: [statsHero('storm', 40, 33, 12, 'S')] },
  { name: 'A', heroes: [statsHero('hela', 20, 13, 7, 'A')] },
  { name: 'B', heroes: [statsHero('thor', 20, 10, 7)] },
]);

describe('TierListTabComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<TierListTabComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  async function answer(stats: unknown, status = 200): Promise<void> {
    http.expectOne('/api/heroes').flush([heroOf('storm', 'Storm', 'Duelist'), heroOf('hela', 'Hela', 'Duelist')]);
    http
      .expectOne('/api/hero-stats')
      .flush(stats as object, { status, statusText: status === 200 ? 'OK' : 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TierListTabComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading while the requests run', async () => {
    expect(host().querySelector('[role="status"]')?.textContent).toContain('Loading');
    await answer(READY);
  });

  it('lists the S and A tiers only and links out to no page', async () => {
    await answer(READY);

    expect(Array.from(host().querySelectorAll('h3')).map((heading) => heading.textContent?.trim())).toEqual([
      'S tier',
      'A tier',
    ]);
    expect(text()).toContain('Storm');
    expect(text()).toContain('82.5%');
    expect(text()).toContain('Hela');
    expect(text()).not.toContain('Thor');
    expect(text()).not.toMatch(/NaN|undefined|null/);
    expect(host().querySelector('a')).toBeNull();
  });

  it('shows the designed empty state, with the minimum named, when no hero is placed', async () => {
    await answer(statsOf([], { matchesCounted: 12 }));

    expect(host().querySelector('.empty-state')).toBeTruthy();
    expect(text()).toContain('10 appearances');
    expect(host().querySelector('a')).toBeNull();
  });

  it('says the tier list cannot be loaded when the request fails, and shows no empty state', async () => {
    await answer('down', 500);

    expect(text()).toContain('cannot be loaded right now');
    expect(host().querySelector('.empty-state')).toBeNull();
  });
});
