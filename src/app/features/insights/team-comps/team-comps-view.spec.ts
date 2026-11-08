import type { HeroStatsHalfSeason } from '../../../../contracts/hero-stats.model';
import type { HeroSynergies, HeroSynergy } from '../../../../contracts/hero-synergies.model';
import type { HeroRole } from '../../../../contracts/role-stats.model';
import type { TeamLineups } from '../../../../contracts/team-lineups.model';
import type { TripleSupportTrios } from '../../../../contracts/triple-support-trios.model';
import type { HeroIdentities } from '../hero-identity';
import { synergiesOf, synergy } from '../hero-synergies.fixtures';
import { lineupShape, lineupsOf } from '../team-lineups.fixtures';
import { triosOf } from '../triple-support-trios.fixtures';
import { PAIRS_PER_ROLE, buildTeamCompsView as buildView } from './team-comps-view';

const buildTeamCompsView = (
  synergies: HeroSynergies,
  identities: HeroIdentities,
  trios: TripleSupportTrios | null = triosOf([]),
  lineups: TeamLineups | null = lineupsOf([]),
) => buildView(synergies, trios, lineups, identities);

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

  describe('for Deadpool, whom the game splits by role', () => {
    const asForm = (hero: 'hero' | 'ally', role: HeroRole, pair: HeroSynergy): HeroSynergy => ({
      ...pair,
      [hero === 'hero' ? 'heroRole' : 'allyRole']: role,
    });

    it('files a pair under the role of the form played, once per form', () => {
      const view = buildTeamCompsView(
        synergiesOf([
          asForm('ally', 'Vanguard', synergy('hulk', 'deadpool', 9, 12)),
          asForm('ally', 'Duelist', synergy('hela', 'deadpool', 8, 12)),
          asForm('ally', 'Strategist', synergy('mantis', 'deadpool', 7, 12)),
        ]),
        identities,
      );

      expect(rowsOf(view, 'Vanguard')).toEqual(['hulk+deadpool']);
      expect(rowsOf(view, 'Duelist')).toEqual(['hela+deadpool']);
      expect(rowsOf(view, 'Strategist')).toEqual(['mantis+deadpool']);
    });

    it('names him with the form and gives the form as his role', () => {
      const view = buildTeamCompsView(
        synergiesOf([asForm('hero', 'Strategist', synergy('deadpool', 'luna-snow', 9, 12))]),
        identities,
      );
      const [row] = view.rolePairs[2].rows;

      expect(row.first).toEqual(
        jasmine.objectContaining({ hero: 'deadpool', name: 'Deadpool (Strategist)', role: 'Strategist' }),
      );
      expect(row.second.name).toBe('Luna Snow');
    });

    it('draws his portrait from the roster, and the one the site keeps for him when the roster has none', () => {
      const pair = synergiesOf([asForm('ally', 'Vanguard', synergy('hulk', 'deadpool', 9, 12))]);
      const withPortrait: HeroIdentities = new Map(identities).set('deadpool', {
        name: 'Deadpool',
        role: 'Multi-Role',
        imageUrl: '/images/roster/deadpool-headshot.png',
      });

      expect(buildTeamCompsView(pair, withPortrait).rolePairs[0].rows[0].second.imageUrl).toBe(
        '/images/roster/deadpool-headshot.png',
      );
      expect(buildTeamCompsView(pair, identities).rolePairs[0].rows[0].second.imageUrl).toBe('/images/heroes/deadpool.png');
    });

    it('keeps a form out of a role it was not played in', () => {
      const view = buildTeamCompsView(
        synergiesOf([asForm('ally', 'Strategist', synergy('hulk', 'deadpool', 9, 12))]),
        identities,
      );

      expect(rowsOf(view, 'Vanguard')).toEqual([]);
      expect(rowsOf(view, 'Strategist')).toEqual([]);
    });

    it('lists two forms with the same partner as separate rows', () => {
      const view = buildTeamCompsView(
        synergiesOf([
          asForm('ally', 'Strategist', synergy('mantis', 'deadpool', 9, 12)),
          asForm('ally', 'Strategist', synergy('luna-snow', 'deadpool', 7, 12)),
        ]),
        identities,
      );

      expect(rowsOf(view, 'Strategist')).toEqual(['mantis+deadpool', 'luna-snow+deadpool']);
    });

    it('leaves the base id, which has no form, out of every list', () => {
      const view = buildTeamCompsView(
        synergiesOf([synergy('hulk', 'deadpool', 9, 12), synergy('mantis', 'deadpool', 9, 12), synergy('hela', 'deadpool', 9, 12)]),
        identities,
      );

      expect(view.rolePairs.map(({ rows }) => rows.length)).toEqual([0, 0, 0]);
    });
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

  it('breaks a tie by matches together and then by hero id', () => {
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

  it('builds the line-up section from the line-ups, and says so when they could not be loaded', () => {
    const pairs = synergiesOf([synergy('hulk', 'thor', 8, 12)]);
    const ready = buildTeamCompsView(pairs, identities, triosOf([]), lineupsOf([lineupShape(2, 2, 2, 600, 330)]));

    expect(ready.lineups.state).toBe('ready');
    expect(buildTeamCompsView(pairs, identities).lineups).toEqual({
      state: 'not-enough-data',
      notice: null,
      minimumLabel: '50 teams',
    });
    expect(buildTeamCompsView(pairs, identities, triosOf([]), null).lineups).toEqual({ state: 'unavailable' });
    expect(buildTeamCompsView(pairs, identities, triosOf([]), null).lineupsNote).toBeNull();
  });

  it('says what is counted in the toolbar, with the minimum', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'thor', 8, 12)], { halfSeason: season(10.5, '2026-10-09T09:00:00Z', null) }),
      identities,
    );

    expect(view.metaParts).toEqual([
      'All ranks counted',
      'Season 10.5',
      'Started Oct 9, 2026',
      'Pairs need 10 matches together to be listed',
    ]);
  });

  it('still says all ranks are counted when no duo is listed, and nothing else', () => {
    expect(buildTeamCompsView(synergiesOf([]), identities).metaParts).toEqual(['All ranks counted']);
  });

  it('names the mode counted, with a caveat for one whose numbers do not compare', () => {
    const competitive = buildTeamCompsView(synergiesOf([]), identities);
    const arcade = buildTeamCompsView(synergiesOf([], { mode: 'arcade' }), identities);

    expect([competitive.modeLabel, competitive.modeCaveat]).toEqual(['Competitive', null]);
    expect(arcade.modeLabel).toBe('Arcade');
    expect(arcade.modeCaveat).toContain('Arcade has custom lobbies');
  });

  it('names the mode and half-season an empty state is about', () => {
    expect(buildTeamCompsView(synergiesOf([]), identities).scopeLabel).toBe('in Competitive for Season 10.5');
  });

  it('explains when the previous half-season stands in for the current one', () => {
    const view = buildTeamCompsView(
      synergiesOf([synergy('hulk', 'thor', 8, 12)], { halfSeason: season(10, null, null), inPlaceOf: season(10.5, null, null) }),
      identities,
    );

    expect(view.fallbackNotice).toBe(
      "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
    );
  });

  it('has no notice and no season before any half-season exists', () => {
    const view = buildTeamCompsView(synergiesOf([], { halfSeason: null }), identities);

    expect(view.season).toBeNull();
    expect(view.fallbackNotice).toBeNull();
  });
});
