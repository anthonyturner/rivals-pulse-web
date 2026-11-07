import { matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import type { HeroIdentities } from '../../insights/hero-identity';
import { buildCountersTabView, COUNTERS_TAB_RECORDS } from './counters-tab-view';

const identities: HeroIdentities = new Map([
  ['hulk', { name: 'Hulk', role: 'Vanguard', imageUrl: '/images/heroes/hulk.png' }],
  ['thor', { name: 'Thor', role: 'Vanguard', imageUrl: '/images/heroes/thor.png' }],
]);

const READY = matchupsOf([
  matchup('hulk', 'thor', 9, 12),
  matchup('thor', 'hulk', 3, 12),
  matchup('storm', 'thor', 11, 12),
  matchup('thor', 'storm', 1, 12),
  matchup('hulk', 'storm', 6, 12),
]);

describe('buildCountersTabView', () => {
  it('is loading until the matchups answer, and unavailable once they could not be read', () => {
    expect(buildCountersTabView(undefined, identities).kind).toBe('loading');
    expect(buildCountersTabView(null, identities).kind).toBe('unavailable');
  });

  it('lists the winning records with the clearest edge first and never a losing or even one', () => {
    const view = buildCountersTabView(READY, identities);

    if (view.kind !== 'ready') {
      fail(`expected ready, got ${view.kind}`);
      return;
    }

    expect(view.records.map((record) => record.key)).toEqual(['storm>thor', 'hulk>thor']);
    expect(view.records[1]).toEqual({
      key: 'hulk>thor',
      winner: { hero: 'hulk', name: 'Hulk', imageUrl: '/images/heroes/hulk.png' },
      loser: { hero: 'thor', name: 'Thor', imageUrl: '/images/heroes/thor.png' },
      winRate: '75.0%',
      sample: '12 matches',
      description: 'Hulk won 9 of 12 against Thor (75.0%) in 12 matches.',
    });
  });

  it('draws a hero the roster lacks under its spelled-out id instead of dropping the record', () => {
    const view = buildCountersTabView(READY, identities);

    expect(view.kind === 'ready' && view.records[0].winner.name).toBe('Storm');
  });

  it('stops at the record limit', () => {
    const many = matchupsOf(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((hero) => matchup(hero, 'z', 9, 12)),
    );

    const view = buildCountersTabView(many, identities);

    expect(view.kind === 'ready' && view.records.length).toBe(COUNTERS_TAB_RECORDS);
  });

  it('says the previous half-season stands in for the current one', () => {
    const view = buildCountersTabView({ ...READY, halfSeason: season(10), inPlaceOf: season(10.5) }, identities);

    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });

  it('is the designed empty state, naming the minimum, when there is no matchup', () => {
    expect(buildCountersTabView(matchupsOf([]), identities)).toEqual({
      kind: 'not-enough-data',
      summary:
        'No hero has a winning record against another yet. A matchup appears once two heroes have faced each other in 10 recorded matches.',
    });
  });

  it('is the empty state when every record is even or losing', () => {
    const view = buildCountersTabView(matchupsOf([matchup('hulk', 'thor', 6, 12), matchup('thor', 'hulk', 3, 12)]), identities);

    expect(view.kind).toBe('not-enough-data');
  });

  it('never prints NaN, whatever the records hold', () => {
    expect(JSON.stringify(buildCountersTabView(READY, identities))).not.toMatch(/NaN|undefined/);
  });
});
