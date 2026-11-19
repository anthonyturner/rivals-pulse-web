import type { HeroSynergies, HeroSynergy } from '../../../../contracts/hero-synergies.model';
import type { TeamLineups } from '../../../../contracts/team-lineups.model';
import type { TripleSupportTrios } from '../../../../contracts/triple-support-trios.model';
import { modeCaveat, modeLabelOf, nonDefaultModeLabel, scopeLabel } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { buildLineupsView, lineupsMethodNote, type LineupsView } from './lineups-view';
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
  lineups: LineupsView;
  /** What the line-up pick rates are out of and who is left out, for the method note; null when there is nothing to say. */
  lineupsNote: string | null;
}

/** Whether any of the page's three sections has numbers to show; a page where none does is empty. */
export function hasTeamCompsData(view: TeamCompsView): boolean {
  return (
    view.rolePairs.some(({ rows }) => rows.length > 0) ||
    view.tripleSupport.state === 'ready' ||
    view.lineups.state === 'ready'
  );
}

/**
 * Turns the hero pairs into what the Team comps page draws. The duos are `rolePairsOf`; the
 * triple-support section is built from `trios` and the line-up section from `lineups`; each is
 * null when its request failed, which its section says, without hiding the duos.
 */
export function buildTeamCompsView(
  synergies: HeroSynergies,
  trios: TripleSupportTrios | null,
  lineups: TeamLineups | null,
  identities: HeroIdentities,
): TeamCompsView {
  const season = synergies.halfSeason === null ? null : seasonView(synergies.halfSeason);
  const modeLabel = modeLabelOf(synergies);
  const minimumLabel = countLabel(synergies.minimumMatches, 'match', 'matches');
  const rolePairs = rolePairsOf(synergies, identities);

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
    lineups: buildLineupsView(lineups, season?.id ?? null),
    lineupsNote: lineupsMethodNote(lineups),
  };
}

/**
 * The top duos of each role, always the three roles in order so a role with no pair says so. A pair
 * is listed under a role only when both heroes were played in that role; a pair across roles, or
 * with a hero the roster does not know, is in no list. A hero the game splits by role (Deadpool)
 * counts in the role of the form played and is named with it ("Deadpool (Strategist)"); his
 * pairs with no form recorded are in no list. Within a role the pairs are ranked by win rate
 * pulled toward 50%, so a short run cannot top the list, and the rate shown is the plain one.
 */
export function rolePairsOf(synergies: HeroSynergies, identities: HeroIdentities): RolePairSectionView[] {
  return PAIR_ROLES.map((role) => ({
    role,
    id: `pairs-${role.toLowerCase()}`,
    heading: `${role} duos`,
    rows: rolePairRows(role, synergies.synergies, identities),
  }));
}

function rolePairRows(role: PairRole, synergies: readonly HeroSynergy[], identities: HeroIdentities): RolePairRowView[] {
  return synergies
    .filter(
      (pair) =>
        Number.isFinite(pair.winRate) &&
        playedRole(pair.hero, pair.heroRole, identities) === role &&
        playedRole(pair.ally, pair.allyRole, identities) === role,
    )
    .sort(
      (a, b) =>
        b.shrunkWinRate - a.shrunkWinRate ||
        b.matches - a.matches ||
        a.hero.localeCompare(b.hero) ||
        a.ally.localeCompare(b.ally),
    )
    .slice(0, PAIRS_PER_ROLE)
    .map((pair, index) => ({
      rank: index + 1,
      first: pairHeroCell(pair.hero, pair.heroRole, identities),
      second: pairHeroCell(pair.ally, pair.allyRole, identities),
      matches: pair.matches,
      winRateLabel: percentLabel(pair.winRate),
    }));
}

/** The role a hero was played in: the form's, or the roster's for a hero with one role. */
function playedRole(hero: string, formRole: string | undefined, identities: HeroIdentities): string | null {
  return formRole ?? identities.get(hero)?.role ?? null;
}

function pairHeroCell(hero: string, formRole: string | undefined, identities: HeroIdentities): HeroCellView {
  const cell = heroCell(hero, identities);

  return formRole === undefined ? cell : { ...cell, name: `${cell.name} (${formRole})`, role: formRole };
}
