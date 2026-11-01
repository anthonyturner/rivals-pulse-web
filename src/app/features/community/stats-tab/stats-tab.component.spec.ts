import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RoleStats, RoleStatsRole } from '../../../../contracts/role-stats.model';
import { emptyFigures, figuresOf } from '../../insights/community-extended.fixtures';
import { StatsTabComponent } from './stats-tab.component';

function role(name: RoleStatsRole['role'], extra: Partial<RoleStatsRole> = {}): RoleStatsRole {
  return {
    role: name,
    appearances: 0,
    status: 'not-enough-data',
    winRate: null,
    killsAverage: null,
    deathsAverage: null,
    assistsAverage: null,
    kda: null,
    finalHitsAverage: null,
    ...extra,
  };
}

const READY: RoleStats = {
  status: 'ready',
  minimumLines: 50,
  halfSeasons: [],
  halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
  inPlaceOf: null,
  modes: [
    {
      id: 'all',
      label: 'Quick Match and Competitive',
      roles: [
        role('Vanguard', {
          appearances: 120,
          status: 'ready',
          winRate: 54.1666,
          killsAverage: 7.25,
          deathsAverage: 5,
          assistsAverage: 4.5,
          kda: 2.35,
          finalHitsAverage: 11.04,
        }),
        role('Duelist', { appearances: 12 }),
        role('Strategist'),
      ],
    },
    {
      id: 'competitive',
      label: 'Competitive',
      roles: [role('Vanguard'), role('Duelist', { appearances: 77, status: 'ready', winRate: 40, kda: 3 }), role('Strategist')],
    },
  ],
};

const FIGURES_READY = figuresOf(
  { Vanguard: { damage: 1234, healing: 0, blocked: 4821 }, Duelist: { damage: 987 } },
  [],
  {},
  { competitive: { roles: [{ role: 'Vanguard', damage: 1500, healing: null, blocked: null }], heroes: [] } },
);

const NOT_ENOUGH: RoleStats = {
  ...READY,
  status: 'not-enough-data',
  modes: [{ id: 'all', label: 'Quick Match and Competitive', roles: [role('Vanguard', { appearances: 12 }), role('Duelist'), role('Strategist')] }],
};

describe('StatsTabComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<StatsTabComponent>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  async function answer(body: unknown, status = 200, figures: unknown = FIGURES_READY): Promise<void> {
    http
      .expectOne('/api/community/stats')
      .flush(body as object, { status, statusText: status === 200 ? 'OK' : 'Server Error' });
    http.expectOne('/api/community/figures').flush(figures as object);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatsTabComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading while the request runs', () => {
    expect(host().querySelector('[role="status"]')?.textContent).toContain('Loading');
    http.expectOne('/api/community/stats').flush(READY);
    http.expectOne('/api/community/figures').flush(FIGURES_READY);
  });

  it("shows each role's figures for the blended modes first", async () => {
    await answer(READY);

    const names = Array.from(host().querySelectorAll('h3')).map((heading) => heading.textContent?.trim());

    expect(names).toEqual(['Vanguard', 'Duelist', 'Strategist']);
    expect(text()).toContain('54.2%');
    expect(text()).toContain('2.35');
    expect(text()).toContain('Season 10.5');
    expect(text()).toContain('Not enough data yet: 12 of 50 lines.');
    expect(text()).not.toMatch(/NaN|undefined|null/);
  });

  it('switches mode and marks the chosen one pressed', async () => {
    await answer(READY);

    const buttons = Array.from(host().querySelectorAll<HTMLButtonElement>('.stats-tab__mode'));
    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    buttons[1].click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      Array.from(host().querySelectorAll<HTMLButtonElement>('.stats-tab__mode')).map((button) => button.getAttribute('aria-pressed')),
    ).toEqual(['false', 'true']);
    expect(text()).toContain('40.0%');
    expect(text()).not.toContain('54.2%');
  });

  it('offers no Arcade or Practice button: Arcade has no lines yet and Practice is held back', async () => {
    const lines = (appearances: number): RoleStatsRole[] => [
      role('Vanguard', { appearances }),
      role('Duelist'),
      role('Strategist'),
    ];

    await answer({
      ...READY,
      modes: [
        ...READY.modes,
        { id: 'arcade', label: 'Arcade', roles: lines(0) },
        { id: 'practice', label: 'Practice', roles: lines(1) },
      ],
    });

    const labels = Array.from(host().querySelectorAll('.stats-tab__mode')).map((button) => button.textContent?.trim());

    expect(labels).toEqual(['Quick Match and Competitive', 'Competitive']);
    expect(text()).not.toContain('Arcade');
    expect(text()).not.toContain('Practice');
  });

  it('shows the designed empty state, with the minimum named, when no role has enough lines', async () => {
    await answer(NOT_ENOUGH);

    expect(host().querySelector('.empty-state')).toBeTruthy();
    expect(text()).toContain('Not enough data yet');
    expect(text()).toContain('50 lines');
    expect(host().querySelector('.stats-tab__mode')).toBeNull();
    expect(text()).not.toMatch(/NaN|undefined|null/);
  });

  it('says the benchmarks cannot be loaded when the request fails, and nothing else', async () => {
    await answer('down', 500);

    expect(text()).toContain('cannot be loaded right now');
    expect(host().querySelector('.empty-state')).toBeNull();
  });

  describe('damage, healing and damage blocked per minute', () => {
    const figuresPanel = (): HTMLElement => host().querySelector('app-community-role-figures') as HTMLElement;
    const cells = (): string[] =>
      Array.from(figuresPanel().querySelectorAll('tbody tr')).map((row) =>
        Array.from(row.children)
          .map((cell) => cell.textContent?.trim())
          .join(' '),
      );

    it('shows a row per role with whole numbers, and "Not enough data" for a figure that is not shown', async () => {
      await answer(READY);

      expect(figuresPanel().textContent).toContain('Damage, healing and damage blocked per minute');
      expect(cells()).toEqual([
        'Vanguard 1,234 0 4,821',
        'Duelist 987 Not enough data Not enough data',
        'Strategist Not enough data Not enough data Not enough data',
      ]);
      expect(figuresPanel().querySelector('table caption')).toBeTruthy();
      expect(figuresPanel().querySelectorAll('th[scope="col"]').length).toBe(4);
      expect(figuresPanel().textContent).toContain('describes those players, not everyone in a lobby');
      expect(figuresPanel().textContent).not.toMatch(/NaN|undefined|null/);
    });

    it('follows the mode chosen for the role figures above it', async () => {
      await answer(READY);

      host().querySelectorAll<HTMLButtonElement>('.stats-tab__mode')[1].click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(cells()[0]).toBe('Vanguard 1,500 Not enough data Not enough data');
    });

    it('shows its own designed empty state, naming the minimum, while the role benchmarks are ready', async () => {
      await answer(READY, 200, emptyFigures());

      expect(host().querySelectorAll('.stats-tab__role').length).toBe(3);
      expect(figuresPanel().querySelector('.empty-state')).toBeTruthy();
      expect(figuresPanel().textContent).toContain('Not enough data yet');
      expect(figuresPanel().textContent).toContain('50 lines');
      expect(figuresPanel().querySelector('table')).toBeNull();
    });

    it('shows its empty state under the role benchmarks empty state, each with its own minimum', async () => {
      await answer(NOT_ENOUGH, 200, emptyFigures());

      expect(host().querySelectorAll('.empty-state').length).toBe(2);
    });

    it('says only itself cannot be loaded when its request fails', async () => {
      await answer(READY, 200, 'down');

      expect(host().querySelectorAll('.stats-tab__role').length).toBe(3);
      expect(figuresPanel().textContent).toContain('cannot be loaded right now');
    });
  });
});
