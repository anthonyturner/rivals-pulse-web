import type { TripleSupportTrio, TripleSupportTrios } from '../../../../contracts/triple-support-trios.model';
import { nonDefaultModeLabel } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';

/** Trios listed per variant, so each card stays a short read. */
export const TRIOS_PER_VARIANT = 5;

export interface TrioRowView {
  /** The three Strategists, in the order of their game ids. */
  heroes: HeroCellView[];
  /** "12.3%": the share of teams that ran exactly this trio. */
  shareLabel: string;
  winRateLabel: string;
  matches: number;
}

export interface TripleVariantView {
  /** "Adam Warlock + Mantis triple", or "Three healers". */
  label: string;
  /** The heading's id, which the variant's table is labelled by. */
  id: string;
  /** "4 trios together: 12.3% of teams · 54.0% win rate": the variant as a whole, so variants compare at a glance. */
  summary: string;
  rows: TrioRowView[];
  /** Set when the variant has more trios than are listed. */
  moreLabel: string | null;
}

/** Teams with four or more Strategists. They are counted as that shape only: no trio, no win rate. */
export interface QuadSupportView {
  /** "3 of 200 teams (1.5%)". */
  label: string;
}

/**
 * - `unavailable`: the trios could not be loaded, which is not the same as there being none.
 * - `not-enough-data`: no trio has reached the minimum in the half-season and mode shown.
 * - `ready`: at least one trio has.
 */
export type TripleSupportView =
  | { state: 'unavailable' }
  | { state: 'not-enough-data'; notice: string | null; minimumLabel: string }
  | {
      state: 'ready';
      notice: string | null;
      /** "10 matches": what a trio needs before it is listed. */
      minimumLabel: string;
      variants: TripleVariantView[];
      quadSupport: QuadSupportView | null;
    };

/**
 * Turns the trios into what the Triple supports section draws: one card per variant, the variant
 * with the largest share of teams first and its trios by share inside it, so the variants can be
 * compared by reading down the page.
 *
 * `shownSeasonId` is the half-season the rest of the page shows. The section names its own when it
 * differs, as it can while one is still short of trios and the other is not.
 */
export function buildTripleSupportView(
  trios: TripleSupportTrios | null,
  shownSeasonId: number | null,
  identities: HeroIdentities,
): TripleSupportView {
  if (trios === null) {
    return { state: 'unavailable' };
  }

  const notice = noticeOf(trios, shownSeasonId);
  const minimumLabel = countLabel(trios.minimumMatches, 'match', 'matches');
  const variants = variantsOf(trios.trios, identities);

  return variants.length === 0
    ? { state: 'not-enough-data', notice, minimumLabel }
    : { state: 'ready', notice, minimumLabel, variants, quadSupport: quadSupportOf(trios) };
}

interface VariantGroup {
  label: string;
  trios: TripleSupportTrio[];
  share: number;
  teams: number;
  wins: number;
}

function variantsOf(trios: readonly TripleSupportTrio[], identities: HeroIdentities): TripleVariantView[] {
  const groups = new Map<string, VariantGroup>();

  for (const trio of trios.filter(isReadable)) {
    const group = groups.get(trio.variant.label) ?? { label: trio.variant.label, trios: [], share: 0, teams: 0, wins: 0 };

    group.trios.push(trio);
    group.share += trio.share;
    group.teams += trio.teams;
    group.wins += trio.wins;
    groups.set(group.label, group);
  }

  return [...groups.values()]
    .sort((a, b) => b.share - a.share || b.teams - a.teams || a.label.localeCompare(b.label))
    .map((group, index): TripleVariantView => {
      const listed = group.trios.sort(
        (a, b) => b.share - a.share || b.matches - a.matches || a.heroes.join().localeCompare(b.heroes.join()),
      );
      const hidden = listed.length - TRIOS_PER_VARIANT;

      return {
        label: group.label,
        id: `triple-variant-${index}`,
        summary: `${countLabel(listed.length, 'trio', 'trios')} together: ${percentLabel(group.share * 100)} of teams · ${percentLabel((group.wins / group.teams) * 100)} win rate`,
        rows: listed.slice(0, TRIOS_PER_VARIANT).map((trio) => trioRow(trio, identities)),
        moreLabel: hidden > 0 ? `${countLabel(hidden, 'more trio', 'more trios')} not shown.` : null,
      };
    });
}

/** A trio with a count that is not a number, or no teams to take a rate over, would show NaN, so it is skipped. */
function isReadable(trio: TripleSupportTrio): boolean {
  return trio.teams > 0 && [trio.share, trio.wins, trio.matches].every(Number.isFinite);
}

function trioRow(trio: TripleSupportTrio, identities: HeroIdentities): TrioRowView {
  return {
    heroes: trio.heroes.map((hero) => heroCell(hero, identities)),
    shareLabel: percentLabel(trio.share * 100),
    winRateLabel: percentLabel((trio.wins / trio.teams) * 100),
    matches: trio.matches,
  };
}

function quadSupportOf(trios: TripleSupportTrios): QuadSupportView | null {
  return trios.classifiedTeams > 0
    ? {
        label: `${trios.fourPlusTeams} of ${countLabel(trios.classifiedTeams, 'team', 'teams')} (${percentLabel((trios.fourPlusTeams / trios.classifiedTeams) * 100)})`,
      }
    : null;
}

function noticeOf(trios: TripleSupportTrios, shownSeasonId: number | null): string | null {
  const season = trios.halfSeason;

  if (season === null || shownSeasonId === null || season.id === shownSeasonId) {
    return null;
  }

  return trios.inPlaceOf === null
    ? `Triple supports are ${season.label}'s numbers.`
    : halfSeasonFallbackNotice(trios.inPlaceOf.label, season.label, nonDefaultModeLabel(trios));
}
