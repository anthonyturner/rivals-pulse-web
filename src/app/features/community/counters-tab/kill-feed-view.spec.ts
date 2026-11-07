import { killPair, killsOf } from '../../insights/community-extended.fixtures';
import { heroIdentities } from '../../insights/hero-identity';
import { season } from '../../insights/hero-matchup.fixtures';
import { COUNTERS_TAB_KILL_PAIRS, buildCountersKillFeedView } from './kill-feed-view';

const IDENTITIES = heroIdentities([
  { id: 'hela', name: 'Hela', role: 'Duelist', imageUrl: '/hela.png' },
  { id: 'hulk', name: 'Hulk', role: 'Vanguard', imageUrl: '/hulk.png' },
]);

describe('buildCountersKillFeedView', () => {
  it('is loading before the answer and unavailable when it could not be read', () => {
    expect(buildCountersKillFeedView(undefined, IDENTITIES)).toEqual({ kind: 'loading' });
    expect(buildCountersKillFeedView(null, IDENTITIES)).toEqual({ kind: 'unavailable' });
  });

  it('lists the pairs with the most seen kills as bands, in the payload order', () => {
    const view = buildCountersKillFeedView(
      killsOf([killPair('hela', 'hulk', 250), killPair('hulk', 'hela', 25)]),
      IDENTITIES,
    );

    expect(view.kind).toBe('ready');
    expect(view.kind === 'ready' && view.pairs.map((pair) => [pair.killer.name, pair.victim.name, pair.band])).toEqual([
      ['Hela', 'Hulk', '250+ seen kills'],
      ['Hulk', 'Hela', '25+ seen kills'],
    ]);
    expect(view.kind === 'ready' && view.pairs[0].description).toBe('Hela killed Hulk in 250+ seen kills.');
  });

  it('draws a hero the roster does not know under its spelled-out id instead of dropping the row', () => {
    const view = buildCountersKillFeedView(killsOf([killPair('rocket-raccoon', 'hulk')]), IDENTITIES);

    expect(view.kind === 'ready' && view.pairs[0].killer.name).toBe('Rocket Raccoon');
  });

  it('keeps to the pairs a summary lists', () => {
    const many = killsOf(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((victim) => killPair('hela', victim)));
    const view = buildCountersKillFeedView(many, IDENTITIES);

    expect(view.kind === 'ready' && view.pairs.length).toBe(COUNTERS_TAB_KILL_PAIRS);
  });

  it('is the designed empty state, naming both minimums, when no pair is listed', () => {
    const view = buildCountersKillFeedView(killsOf([]), IDENTITIES);

    expect(view.kind).toBe('not-enough-data');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('10 recorded matches');
    expect(view.kind === 'not-enough-data' && view.summary).toContain('at least 3 different players');
  });

  it('says the previous half-season stands in', () => {
    const view = buildCountersKillFeedView(
      killsOf([killPair('hela', 'hulk')], { halfSeason: season(10), inPlaceOf: season(10.5) }),
      IDENTITIES,
    );

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.notice).toContain('Season 10.5 does not have enough data yet');
  });
});
