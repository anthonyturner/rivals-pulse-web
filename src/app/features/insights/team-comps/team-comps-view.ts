import type { HeroSynergies, HeroSynergy } from '../../../../contracts/hero-synergies.model';
import type { TripleSupportTrios } from '../../../../contracts/triple-support-trios.model';
import { modeCaveat, modeLabelOf, nonDefaultModeLabel, scopeLabel } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { buildTripleSupportView, type TripleSupportView } from './triple-support-view';

/** RivalsPulse has no rank breakdown, so the page says that every figure counts every rank. */
const ALL_RANKS_FACT = 'All ranks counted';

export const PAIR_ROLES = ['Vanguard', 'Duelist', 'Strategist'] as const;

export type PairRole = (typeof PAIR_ROLES)[number];

/** Pairs listed per role, so each table stays a short read. */
export const PAIRS_PER_ROLE = 10;

export interface RolePairRowView {
  rank: number;
  first: HeroCellView;
  second: HeroCellView;
  matches: number;
  winRateLabel: string;
}

export interface RolePairSectionView {
  role: PairRole;
  /** The heading's id, which the section's table is labelled by. */
  id: string;
  /** "Vanguard duos". */
  heading: string;
  /** Empty when no pair of this role has reached the minimum. */
  rows: RolePairRowView[];
}

/** A section whose source is not built yet: it shows "Not enough data yet" until its rows can be filled. */
export interface PendingSectionView {
  state: 'not-enough-data';
}

export interface TeamCompsView {
  /** The half-season the numbers come from; null before any half-season exists. */
  season: SeasonView | null;
  /** The mode the numbers count, such as "Competitive" or "Quick Match and Competitive". */
  modeLabel: string;
  /** Set for a mode whose numbers do not mean what Quick Match and Competitive do. */
  modeCaveat: string | null;
  /** Set when the numbers are the previous half-season's, shown until the current one has enough data. */
  fallbackNotice: string | null;
  /** "in Competitive for Season 10.5": names the mode and half-season that an empty state is about. */
  scopeLabel: string;
  /** "10 matches", or "1 match". */
  minimumLabel: string;
  /** The toolbar's facts in reading order. */
  metaParts: string[];
  /** Always the three roles, in order, so a role with no pair says so instead of vanishing. */
  rolePairs: RolePairSectionView[];
  tripleSupport: TripleSupportView;
  /** Waits for the line-up counts; see issue 126. */
  lineups: PendingSectionView;
}

/**
 * Turns the hero pairs into what the Team comps page draws. A pair is listed under a role only when
 * both heroes have that role; a pair across roles, or with a hero the roster does not know, is in no
 * list. Within a role the pairs are ranked by win rate pulled toward 50%, so a short run cannot top
 * the list, and the rate shown is the plain one.
 *
 * The triple-support section is built from `trios` (null when they could not be loaded, which the
 * section says, without hiding the duos). The line-up section has no source yet, so it is pending.
 */
export function buildTeamCompsView(
  synergies: HeroSynergies,
  trios: TripleSupportTrios | null,
  identities: HeroIdentities,
): TeamCompsView {
  const season = synergies.halfSeason === null ? null : seasonView(synergies.halfSeason);
  const modeLabel = modeLabelOf(synergies);
  const minimumLabel = countLabel(synergies.minimumMatches, 'match', 'matches');
  const rolePairs = PAIR_ROLES.map((role) => ({
    role,
    id: `pairs-${role.toLowerCase()}`,
    heading: `${role} duos`,
    rows: rolePairRows(role, synergies.synergies, identities),
  }));

  return {
    season,
    modeLabel,
    modeCaveat: modeCaveat(synergies.mode),
    fallbackNotice:
      synergies.inPlaceOf === null
        ? null
        : halfSeasonFallbackNotice(synergies.inPlaceOf.label, season?.label ?? null, nonDefaultModeLabel(synergies)),
    scopeLabel: scopeLabel(modeLabel, season?.label ?? null),
    minimumLabel,
    metaParts: [
      ALL_RANKS_FACT,
      ...(rolePairs.some(({ rows }) => rows.length > 0)
        ? [season?.label, season?.dateRange, `Pairs need ${minimumLabel} together to be listed`]
        : []),
    ].filter((part): part is string => !!part),
    rolePairs,
    tripleSupport: buildTripleSupportView(trios, season?.id ?? null, identities),
    lineups: { state: 'not-enough-data' },
  };
}

function rolePairRows(role: PairRole, synergies: readonly HeroSynergy[], identities: HeroIdentities): RolePairRowView[] {
  return synergies
    .filter((pair) => Number.isFinite(pair.winRate) && roleOf(pair.hero, identities) === role && roleOf(pair.ally, identities) === role)
    .sort(
      (a, b) =>
        b.shrunkWinRate - a.shrunkWinRate ||
        b.matches - a.matches ||
        a.hero.localeCompare(b.hero) ||
        a.ally.localeCompare(b.ally),
    )
    .slice(0, PAIRS_PER_ROLE)
    .map((pair, index) => {
      const first = heroCell(pair.hero, identities);
      const second = heroCell(pair.ally, identities);

      return {
        rank: index + 1,
        first,
        second,
        matches: pair.matches,
        winRateLabel: percentLabel(pair.winRate),
      };
    });
}

function roleOf(hero: string, identities: HeroIdentities): string | null {
  return identities.get(hero)?.role ?? null;
}
