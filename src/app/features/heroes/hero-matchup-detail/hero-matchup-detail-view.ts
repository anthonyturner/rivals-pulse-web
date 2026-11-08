import type { CommunityKills } from '../../../../contracts/community-kills.model';
import type { HeroMatchup, HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { KILL_FEED_CAVEAT, killsBandLabel } from '../../insights/hero-kill-feed';
import { matchupBetween, recordSampleLabel, recordWinRateLabel, type RosterHero } from '../../insights/hero-matchup-records';
import { finalHitsLabel, kdaLabel, percentLabel } from '../../../shared/utilities/stat-labels';

/** One hero's half of a head-to-head: how it fared against the other, and how that compares to its usual. */
export interface HeadToHeadSide {
  hero: RosterHero;
  /** Its record against the other hero, or null when that record is below the minimum. */
  record: { winRate: string; wins: number; appearances: number } | null;
  /** Its matchup win rate against its overall one; null when the two cannot be compared. */
  edge: { points: string; usual: string } | null;
  /** How often it was seen killing the other hero; null when the pair is not in the payload. */
  killsBand: string | null;
  /** Its form across all its matches, not only this encounter; null when the hero is not placed. */
  overall: { kda: string; finalHits: string } | null;
}

export interface HeadToHeadView {
  /** The matches behind the encounter, such as "12 matches". */
  sample: string;
  halfSeasonLabel: string | null;
  /** The hero whose page this is, then the opponent. */
  sides: [HeadToHeadSide, HeadToHeadSide];
  /** False when the kill feed is missing or from another half-season, so the section is left out. */
  showKillFeed: boolean;
  killFeedCaveat: string;
}

/**
 * The head-to-head between the page's hero and one opponent, built only from what the hero page has
 * already loaded. Figures from another half-season than the matchups are left out rather than set
 * side by side with them. Null when either hero is unknown or neither has a record against the other.
 */
export function buildHeadToHeadView(
  matchups: HeroMatchups,
  stats: HeroStats | null | undefined,
  kills: CommunityKills | null | undefined,
  heroId: string,
  opponentId: string,
  roster: readonly RosterHero[],
): HeadToHeadView | null {
  const hero = roster.find((entry) => entry.id === heroId);
  const opponent = roster.find((entry) => entry.id === opponentId);
  const forward = matchupBetween(matchups, heroId, opponentId);
  const backward = matchupBetween(matchups, opponentId, heroId);
  const sampleRecord = forward ?? backward;

  if (hero === undefined || opponent === undefined || sampleRecord === undefined) {
    return null;
  }

  const season = matchups.halfSeason;
  const placed = sameHalfSeason(stats?.halfSeason, season) ? placedHeroes(stats) : new Map<string, HeroStatsHero>();
  // A feed with no pair yet would make every pair read as "not among the most seen", so it is left out.
  const killPairs = kills?.status === 'ready' && sameHalfSeason(kills.halfSeason, season) ? kills.pairs : null;

  const side = (self: RosterHero, other: RosterHero, record: HeroMatchup | undefined): HeadToHeadSide => {
    const usual = placed.get(self.id);
    const pair = killPairs?.find((entry) => entry.killer === self.id && entry.victim === other.id);

    return {
      hero: self,
      record:
        record === undefined
          ? null
          : { winRate: recordWinRateLabel(record), wins: record.wins, appearances: record.appearances },
      edge: record === undefined || usual === undefined ? null : edgeOf(record.winRate, usual.winRate),
      killsBand: pair === undefined ? null : killsBandLabel(pair.killsBand),
      overall:
        usual === undefined
          ? null
          : {
              kda: kdaLabel(usual.kda),
              finalHits: finalHitsLabel(usual.finalHitsAverage),
            },
    };
  };

  return {
    sample: recordSampleLabel(sampleRecord),
    halfSeasonLabel: season?.label ?? null,
    sides: [side(hero, opponent, forward), side(opponent, hero, backward)],
    showKillFeed: killPairs !== null,
    killFeedCaveat: KILL_FEED_CAVEAT,
  };
}

function sameHalfSeason(a: HeroStatsHalfSeason | null | undefined, b: HeroStatsHalfSeason | null): boolean {
  return a !== null && a !== undefined && b !== null && a.id === b.id;
}

function placedHeroes(stats: HeroStats | null | undefined): Map<string, HeroStatsHero> {
  return new Map((stats?.tiers ?? []).flatMap((tier) => tier.heroes).map((entry) => [entry.hero, entry]));
}

/** Points above or below the usual rate, rounded as shown so "+0.0" never appears beside "even". */
function edgeOf(matchupRate: number, usualRate: number): HeadToHeadSide['edge'] {
  if (!Number.isFinite(matchupRate) || !Number.isFinite(usualRate)) {
    return null;
  }

  const points = Math.round((matchupRate - usualRate) * 10) / 10;
  const usual = percentLabel(usualRate);

  if (points === 0) {
    return { points: 'Even', usual };
  }

  return { points: `${points > 0 ? '+' : '−'}${Math.abs(points).toFixed(1)} points`, usual };
}
