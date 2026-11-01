import type { CommunityKillPair, CommunityKills } from '../../../../contracts/community-kills.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import {
  killPairMinimum,
  killPairSentence,
  killedBy,
  killsBandLabel,
  killsBy,
} from '../../insights/hero-kill-feed';
import type { RosterHero } from '../../insights/hero-matchup-records';

/** One hero on a pair, with the band and sentence its card shows. */
export interface KillFeedCard<H extends RosterHero = RosterHero> {
  hero: H;
  band: string;
  /** The pair in words, for the card's tooltip. */
  description: string;
}

export type HeroKillFeedView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; halfSeasonLabel: string | null; fallbackFor: string | null; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      fallbackFor: string | null;
      /** The shared fallback sentence, set when this is the previous half-season. */
      notice: string | null;
      /** Heroes this hero was seen killing most. */
      killsMost: KillFeedCard[];
      /** Heroes seen killing this hero most. */
      killedByMost: KillFeedCard[];
    };

/**
 * What a hero page shows for one hero's kill feed. `undefined` means the counters have not answered
 * yet and `null` means they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildHeroKillFeedView(
  kills: CommunityKills | null | undefined,
  heroId: string,
  heroName: string,
  roster: readonly RosterHero[],
): HeroKillFeedView {
  if (kills === undefined) {
    return { kind: 'loading' };
  }

  if (kills === null) {
    return { kind: 'unavailable' };
  }

  const halfSeasonLabel = kills.halfSeason?.label ?? null;
  const fallbackFor = kills.inPlaceOf?.label ?? null;
  const byId = new Map(roster.map((hero) => [hero.id, hero]));
  const cards = (pairs: readonly CommunityKillPair[], shown: 'killer' | 'victim'): KillFeedCard[] =>
    pairs.flatMap((pair) => {
      const portrait = byId.get(pair[shown]);
      const killer = byId.get(pair.killer);
      const victim = byId.get(pair.victim);

      // A pair naming a hero the roster does not know is left out rather than shown half-blank.
      return portrait === undefined || killer === undefined || victim === undefined
        ? []
        : [{ hero: portrait, band: killsBandLabel(pair.killsBand), description: killPairSentence(pair, killer.name, victim.name) }];
    });
  const killsMost = cards(killsBy(kills, heroId), 'victim');
  const killedByMost = cards(killedBy(kills, heroId), 'killer');

  if (killsMost.length === 0 && killedByMost.length === 0) {
    const where = fallbackFor === null || halfSeasonLabel === null ? '' : ` in ${halfSeasonLabel}`;
    const subject = kills.pairs.length === 0 ? 'No hero pair is' : `${heroName} is not`;

    return {
      kind: 'not-enough-data',
      halfSeasonLabel,
      fallbackFor,
      summary: `${subject} in enough kill feeds from Rivals Pulse players yet${where}. ${killPairMinimum(kills)}`,
    };
  }

  return {
    kind: 'ready',
    halfSeasonLabel,
    fallbackFor,
    notice: kills.inPlaceOf === null ? null : halfSeasonFallbackNotice(kills.inPlaceOf.label, halfSeasonLabel),
    killsMost,
    killedByMost,
  };
}
