import type { CommunityKills } from '../../../../contracts/community-kills.model';
import type { HeroMatchup } from '../../../../contracts/hero-matchups.model';
import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import { buildHeadToHeadView } from './hero-matchup-detail-view';

const roster = [
  { id: 'hulk', name: 'Hulk', imageUrl: '/hulk.png' },
  { id: 'thor', name: 'Thor', imageUrl: '/thor.png' },
];

const placed = (hero: string, winRate: number, kda: number | null, finalHitsAverage: number | null): HeroStatsHero => ({
  hero,
  appearances: 100,
  wins: winRate,
  winRate,
  pickRate: 10,
  shrunkWinRate: winRate,
  tier: 'A',
  kda,
  finalHitsAverage,
});

function statsOf(heroes: HeroStatsHero[], seasonId = 10.5): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [season(seasonId)],
    halfSeason: season(seasonId),
    inPlaceOf: null,
    matchesCounted: 500,
    tiers: [{ name: 'A', heroes }],
    belowMinimum: [],
  };
}

function killsOf(pairs: CommunityKills['pairs'], seasonId = 10.5): CommunityKills {
  return {
    status: 'ready',
    minimums: { pairMatches: 5, recorders: 2 },
    halfSeasons: [season(seasonId)],
    halfSeason: season(seasonId),
    inPlaceOf: null,
    pairs,
  };
}

const bothSides = matchupsOf([matchup('hulk', 'thor', 9, 12), matchup('thor', 'hulk', 3, 12)]);
const stats = statsOf([placed('hulk', 51, 2.345, 4.25), placed('thor', 50, null, null)]);
const kills = killsOf([{ killer: 'hulk', victim: 'thor', killsBand: 25 }]);

describe('buildHeadToHeadView', () => {
  it('shows both sides of the record, the edge over each usual win rate, the kill feed and overall form', () => {
    const view = buildHeadToHeadView(bothSides, stats, kills, 'hulk', 'thor', roster);

    expect(view?.sample).toBe('12 matches');
    expect(view?.halfSeasonLabel).toBe('Season 10.5');
    expect(view?.showKillFeed).toBeTrue();

    const [hulk, thor] = view!.sides;
    expect(hulk.hero.name).toBe('Hulk');
    expect(hulk.record).toEqual({ winRate: '75.0%', wins: 9, appearances: 12 });
    expect(hulk.edge).toEqual({ points: '+24.0 points', usual: '51.0%' });
    expect(hulk.killsBand).toBe('25+ seen kills');
    expect(hulk.overall).toEqual({ kda: '2.35', finalHits: '4.3' });

    expect(thor.record).toEqual({ winRate: '25.0%', wins: 3, appearances: 12 });
    expect(thor.edge).toEqual({ points: '−25.0 points', usual: '50.0%' });
    expect(thor.killsBand).toBeNull();
    expect(thor.overall).toEqual({ kda: 'Not recorded', finalHits: 'Not recorded' });
  });

  describe('while facing the other hero', () => {
    const withFigures = matchupsOf([
      matchup('hulk', 'thor', 9, 12, { kda: 3.456, finalHitsAverage: 5.25 }),
      matchup('thor', 'hulk', 3, 12, { kda: 0.5, finalHitsAverage: null }),
    ]);

    it('shows each hero its own figures in the matches against the other, beside the overall ones', () => {
      const [hulk, thor] = buildHeadToHeadView(withFigures, stats, kills, 'hulk', 'thor', roster)!.sides;

      expect(hulk.encounter).toEqual({ kda: '3.46', finalHits: '5.3' });
      expect(hulk.overall).toEqual({ kda: '2.35', finalHits: '4.3' });
      expect(thor.encounter).toEqual({ kda: '0.50', finalHits: 'Not recorded' });
    });

    it('shows them even where the usual figures are not placed, as they come from the matchup alone', () => {
      const view = buildHeadToHeadView(withFigures, undefined, null, 'hulk', 'thor', roster);

      expect(view?.sides[0].overall).toBeNull();
      expect(view?.sides[0].encounter).toEqual({ kda: '3.46', finalHits: '5.3' });
    });

    it('leaves them out, rather than showing zero, when the matchup carries neither figure', () => {
      const [hulk, thor] = buildHeadToHeadView(bothSides, stats, kills, 'hulk', 'thor', roster)!.sides;

      expect(hulk.encounter).toBeNull();
      expect(thor.encounter).toBeNull();
    });

    it('leaves them out for a side with no record against the other', () => {
      const view = buildHeadToHeadView(matchupsOf([matchup('thor', 'hulk', 3, 12, { kda: 2, finalHitsAverage: 1 })]), stats, kills, 'hulk', 'thor', roster);

      expect(view?.sides[0].encounter).toBeNull();
      expect(view?.sides[1].encounter).toEqual({ kda: '2.00', finalHits: '1.0' });
    });

    it('reads a record from a server that sent no figures, or one that is not a number, as missing and never prints NaN', () => {
      const older: Partial<HeroMatchup> = matchup('hulk', 'thor', 9, 12);
      delete older.kda;
      delete older.finalHitsAverage;
      const view = buildHeadToHeadView(
        matchupsOf([older as HeroMatchup, matchup('thor', 'hulk', 3, 12, { kda: Number.NaN, finalHitsAverage: Number.NaN })]),
        stats,
        kills,
        'hulk',
        'thor',
        roster,
      );

      expect(view?.sides.map((side) => side.encounter)).toEqual([null, null]);
      expect(JSON.stringify(view)).not.toContain('NaN');
    });
  });

  it('says "Even" when the matchup rate rounds to the usual one', () => {
    const view = buildHeadToHeadView(bothSides, statsOf([placed('hulk', 75.04, 1, 1)]), null, 'hulk', 'thor', roster);

    expect(view?.sides[0].edge).toEqual({ points: 'Even', usual: '75.0%' });
  });

  it('leaves a side without a record when its mirror is below the minimum', () => {
    const view = buildHeadToHeadView(matchupsOf([matchup('thor', 'hulk', 3, 12)]), stats, kills, 'hulk', 'thor', roster);

    expect(view?.sides[0].record).toBeNull();
    expect(view?.sides[0].edge).toBeNull();
    expect(view?.sides[1].record?.winRate).toBe('25.0%');
  });

  it('leaves out figures from another half-season than the matchups', () => {
    const view = buildHeadToHeadView(bothSides, statsOf([placed('hulk', 51, 2, 4)], 10), killsOf([], 10), 'hulk', 'thor', roster);

    expect(view?.sides[0].edge).toBeNull();
    expect(view?.sides[0].overall).toBeNull();
    expect(view?.showKillFeed).toBeFalse();
  });

  it('leaves out a kill feed that has no pair yet, rather than calling every pair low', () => {
    const view = buildHeadToHeadView(bothSides, stats, { ...killsOf([]), status: 'not-enough-data' }, 'hulk', 'thor', roster);

    expect(view?.showKillFeed).toBeFalse();
  });

  it('leaves out the edge when a rate is not a number', () => {
    const view = buildHeadToHeadView(bothSides, statsOf([placed('hulk', Number.NaN, 1, 1)]), null, 'hulk', 'thor', roster);

    expect(view?.sides[0].edge).toBeNull();
  });

  it('works without stats or a kill feed', () => {
    const view = buildHeadToHeadView(bothSides, undefined, null, 'hulk', 'thor', roster);

    expect(view?.sides[0].record?.winRate).toBe('75.0%');
    expect(view?.sides[0].overall).toBeNull();
    expect(view?.showKillFeed).toBeFalse();
  });

  it('is null for a hero the roster does not know, or a pair with no record either way', () => {
    expect(buildHeadToHeadView(bothSides, stats, kills, 'hulk', 'storm', roster)).toBeNull();
    expect(buildHeadToHeadView(matchupsOf([]), stats, kills, 'hulk', 'thor', roster)).toBeNull();
  });
});
