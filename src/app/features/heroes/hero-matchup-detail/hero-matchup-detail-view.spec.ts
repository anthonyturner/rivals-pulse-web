import type { CommunityKills } from '../../../../contracts/community-kills.model';
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
