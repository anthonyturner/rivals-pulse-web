import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { HeroCommunityStatsComponent } from './hero-community-stats.component';

const season = (id: number) => ({ id, label: `Season ${id}`, startsAt: null, endsAt: null });

const readyStats: HeroStats = {
  status: 'ready',
  minimumMatches: 10,
  halfSeasons: [season(10), season(10.5)],
  halfSeason: season(10.5),
  inPlaceOf: null,
  matchesCounted: 150,
  tiers: [
    {
      name: 'B',
      heroes: [
        {
          hero: 'storm',
          appearances: 24,
          wins: 13,
          winRate: 54.1666,
          pickRate: 16,
          shrunkWinRate: 52.9,
          tier: 'B',
          kda: 3.456,
          finalHitsAverage: 9.04,
        },
      ],
    },
  ],
  belowMinimum: [{ hero: 'rocket-raccoon', appearances: 4 }],
};

describe('HeroCommunityStatsComponent', () => {
  let fixture: ComponentFixture<HeroCommunityStatsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroCommunityStatsComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroCommunityStatsComponent);
  });

  async function show(heroId: string, heroName: string, stats: HeroStats | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('heroId', heroId);
    fixture.componentRef.setInput('heroName', heroName);
    fixture.componentRef.setInput('stats', stats);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  it('shows every figure and the sample size, labelled as Rivals Pulse players, for a hero with enough data', async () => {
    const root = await show('storm', 'Storm', readyStats);
    const text = root.textContent ?? '';
    const terms = [...root.querySelectorAll('dt')].map((term) => term.textContent?.trim());
    const values = [...root.querySelectorAll('dd')].map((value) => value.textContent?.trim());

    expect(text).toContain('Rivals Pulse players');
    expect(terms).toEqual(['Win rate', 'Pick rate', 'KDA', 'Final hits per match']);
    expect(values).toEqual(['54.2%', '16.0%', '3.46', '9.0']);
    expect(text).toContain('From 24 appearances in 150 matches recorded by Rivals Pulse players');
    expect(text).toContain('Half-season: Season 10.5');
    expect(text).not.toContain('Not enough data yet');
  });

  it('shows "Not enough data yet" with the matches so far, and no figures, below the minimum', async () => {
    const root = await show('rocket-raccoon', 'Rocket Raccoon', readyStats);
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('Rocket Raccoon has 4 appearances so far');
    expect(text).toContain('The numbers appear at 10 appearances.');
    expect(root.querySelector('dl')).toBeNull();
    expect(text).not.toMatch(/NaN|\b0\.0%|Infinity/);
  });

  it('says no match has the hero when the data never mentions it', async () => {
    const root = await show('rocket-raccoon', 'Rocket Raccoon', {
      ...readyStats,
      status: 'not-enough-data',
      halfSeason: null,
      matchesCounted: 0,
      tiers: [],
      belowMinimum: [],
    });
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('No match recorded by Rivals Pulse players has Rocket Raccoon yet');
    expect(text).not.toMatch(/NaN|\b0\.0%|Infinity/);
  });

  it('labels the previous half-season when it stands in for the current one', async () => {
    const root = await show('storm', 'Storm', { ...readyStats, halfSeason: season(10), inPlaceOf: season(10.5) });
    const text = root.textContent ?? '';

    expect(text).toContain('Previous half-season.');
    expect(text).toContain("Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.");
    expect(root.querySelectorAll('dd').length).toBe(4);
  });

  it('shows the appearances so far, without a fallback notice, for a hero below the minimum in a stand-in half-season', async () => {
    const root = await show('rocket-raccoon', 'Rocket Raccoon', {
      ...readyStats,
      halfSeason: season(10),
      inPlaceOf: season(10.5),
    });
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('Rocket Raccoon has 4 appearances so far in Season 10');
    expect(text).toContain('(standing in for Season 10.5)');
    expect(text).not.toContain('Previous half-season.');
  });

  it('says so when the stats could not be read, rather than showing an empty panel', async () => {
    const root = await show('storm', 'Storm', null);

    expect(root.textContent).toContain('cannot be loaded right now');
    expect(root.querySelector('dl')).toBeNull();
  });

  it('shows a loading line before the stats answer', async () => {
    const root = await show('storm', 'Storm', undefined);

    expect(root.querySelector('[role="status"]')?.textContent).toContain('Loading');
  });

  it('names the section by its heading, so assistive technology announces the hero', async () => {
    const root = await show('storm', 'Storm', readyStats);
    const section = root.querySelector('section') as HTMLElement;
    const heading = root.querySelector(`#${section.getAttribute('aria-labelledby')}`);

    expect(heading?.textContent).toContain('Storm');
  });
});
