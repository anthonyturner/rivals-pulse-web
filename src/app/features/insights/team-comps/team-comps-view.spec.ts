import type { HeroStatsHalfSeason } from '../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../hero-identity';
import { synergiesOf, synergy } from '../hero-synergies.fixtures';
import { PAIRS_PER_ROLE, buildTeamCompsView } from './team-comps-view';

const identities: HeroIdentities = new Map([
  ['hulk', { name: 'Hulk', role: 'Vanguard', imageUrl: '/images/heroes/hulk.png' }],
  ['thor', { name: 'Thor', role: 'Vanguard', imageUrl: '/images/heroes/thor.png' }],
  ['venom', { name: 'Venom', role: 'Vanguard', imageUrl: null }],
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: null }],
  ['hela', { name: 'Hela', role: 'Duelist', imageUrl: null }],
  ['mantis', { name: 'Mantis', role: 'Strategist', imageUrl: null }],
  ['luna-snow', { name: 'Luna Snow', role: 'Strategist', imageUrl: null }],
  ['deadpool', { name: 'Deadpool', role: 'Multi-Role', imageUrl: null }],
]);

const rowsOf = (view: ReturnType<typeof buildTeamCompsView>, role: string) =>
  view.rolePairs.find((section) => section.role === role)?.rows.map((row) => `${row.first.hero}+${row.second.hero}`);

describe('buildTeamCompsView role pairs', () => {
  it('files a pair under a role only when both heroes have it', () => {
    const view = buildTeamCompsView(
      synergiesOf([
        synergy('hulk', 'thor', 8, 12),
        synergy('hela', 'storm', 7, 12),
        synergy('luna-snow', 'mantis', 9, 12),
        synergy('hulk', 'storm', 11, 12),
        synergy('mantis', 'thor', 11, 12),
      ]),
      identities,
    );

    expect(rowsOf(view, 'Vanguard')).toEqual(['hulk+thor']);
    expect(rowsOf(view, 'Duelist')).toEqual(['hela+storm']);
    expect(rowsOf(view, 'Strategist')).toEqual(['luna-snow+mantis']);
  });

  it('leaves out a pair with a hero the roster lacks or that has no single role', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'new-hero', 9, 12), synergy('deadpool', 'hulk', 9, 12), synergy('hulk', 'thor', 6, 12)]),
      identities,
    );

    expect(rowsOf(view, 'Vanguard')).toEqual(['hulk+thor']);
    expect(rowsOf(view, 'Duelist')).toEqual([]);
    expect(rowsOf(view, 'Strategist')).toEqual([]);
  });

  it('always lists the three roles in order, each with its heading', () => {
    const view = buildTeamCompsView(synergiesOf([]), identities);

    expect(view.rolePairs.map(({ role, heading, id }) => [role, heading, id])).toEqual([
      ['Vanguard', 'Vanguard duos', 'pairs-vanguard'],
      ['Duelist', 'Duelist duos', 'pairs-duelist'],
      ['Strategist', 'Strategist duos', 'pairs-strategist'],
    ]);
  });

  it('ranks by the shrunk win rate, so a short run does not top a long one, and shows the plain rate', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'thor', 5, 5), synergy('hulk', 'venom', 140, 200), synergy('thor', 'venom', 4, 10)]),
      identities,
    );
    const [first, second, third] = view.rolePairs[0].rows;

    expect([first.first.hero, first.second.hero]).toEqual(['hulk', 'venom']);
    expect(first.winRateLabel).toBe('70.0%');
    expect(first.rank).toBe(1);
    expect([second.winRateLabel, third.winRateLabel]).toEqual(['100.0%', '40.0%']);
    expect(second.matches).toBe(5);
  });

  it('breaks a tie by matches together and then by name', () => {
    const view = buildTeamCompsView(
      synergiesOf([
        { ...synergy('hulk', 'venom', 5, 10), shrunkWinRate: 50 },
        { ...synergy('hulk', 'thor', 10, 20), shrunkWinRate: 50 },
        { ...synergy('thor', 'venom', 10, 20), shrunkWinRate: 50 },
      ]),
      identities,
    );

    expect(rowsOf(view, 'Vanguard')).toEqual(['hulk+thor', 'thor+venom', 'hulk+venom']);
  });

  it(`lists at most ${PAIRS_PER_ROLE} pairs for a role`, () => {
    const heroes = Array.from({ length: 6 }, (_, index) => `vanguard-${index}`);
    const roster: HeroIdentities = new Map(heroes.map((id) => [id, { name: id, role: 'Vanguard', imageUrl: null }]));
    const pairs = heroes.flatMap((hero, index) => heroes.slice(index + 1).map((ally) => synergy(hero, ally, 6, 12)));

    expect(pairs.length).toBeGreaterThan(PAIRS_PER_ROLE);
    expect(buildTeamCompsView(synergiesOf(pairs), roster).rolePairs[0].rows.length).toBe(PAIRS_PER_ROLE);
  });

  it('names a hero the roster does not know by its id instead of dropping the row', () => {
    const roster: HeroIdentities = new Map([['hulk', { name: 'Hulk', role: 'Vanguard', imageUrl: null }]]);
    const view = buildTeamCompsView(synergiesOf([synergy('hulk', 'new-hero', 6, 12)]), roster);

    expect(rowsOf(view, 'Vanguard')).toEqual([]);
  });

  it('skips a pair whose rate is not a number', () => {
    const view = buildTeamCompsView(
      synergiesOf([{ ...synergy('hulk', 'thor', 6, 12), winRate: Number.NaN }, synergy('hulk', 'venom', 6, 12)]),
      identities,
    );

    expect(rowsOf(view, 'Vanguard')).toEqual(['hulk+venom']);
  });
});

describe('buildTeamCompsView sections and labels', () => {
  const season = (id: number, startsAt: string | null, endsAt: string | null): HeroStatsHalfSeason => ({
    id,
    label: `Season ${id}`,
    startsAt,
    endsAt,
  });

  it('keeps the triple-support and line-up sections pending until they have a source', () => {
    const view = buildTeamCompsView(synergiesOf([synergy('hulk', 'thor', 8, 12)]), identities);

    expect(view.tripleSupport).toEqual({ state: 'not-enough-data' });
    expect(view.lineups).toEqual({ state: 'not-enough-data' });
  });

  it('says what is counted in the toolbar, with the minimum', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'thor', 8, 12)], { halfSeason: season(10.5, '2026-10-09T09:00:00Z', null) }),
      identities,
    );

    expect(view.metaParts).toEqual(['Season 10.5', 'Started Oct 9, 2026', 'Pairs need 10 matches together to be listed']);
  });

  it('has no toolbar facts when no duo is listed', () => {
    expect(buildTeamCompsView(synergiesOf([]), identities).metaParts).toEqual([]);
  });

  it('explains when the previous half-season stands in for the current one', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'thor', 8, 12)], { halfSeason: season(10, null, null), inPlaceOf: season(10.5, null, null) }),
      identities,
    );

    expect(view.fallbackNotice).toBe("Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.");
  });

  it('has no notice and no season before any half-season exists', () => {
    const view = buildTeamCompsView(synergiesOf([], { halfSeason: null }), identities);

    expect(view.season).toBeNull();
    expect(view.fallbackNotice).toBeNull();
  });
});
