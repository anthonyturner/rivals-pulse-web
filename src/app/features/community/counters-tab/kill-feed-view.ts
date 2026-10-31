import type { CommunityKills } from '../../../../contracts/community-kills.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroIdentities } from '../../insights/hero-identity';
import { killPairMinimum, killPairSentence, killsBandLabel, topKillPairs } from '../../insights/hero-kill-feed';

/** Pairs listed: a summary, not the whole kill feed. */
export const COUNTERS_TAB_KILL_PAIRS = 5;

interface PairHero {
  hero: string;
  name: string;
  imageUrl: string;
}

export interface KillPairView {
  key: string;
  killer: PairHero;
  victim: PairHero;
  band: string;
  /** The pair in words, for the row's tooltip. */
  description: string;
}

export type CountersKillFeedView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data'; summary: string }
  | {
      kind: 'ready';
      halfSeasonLabel: string | null;
      /** The shared fallback sentence, set when the previous half-season stands in for the current one. */
      notice: string | null;
      pairs: KillPairView[];
    };

/**
 * What the Counters tab shows for the kill feed: the pairs with the most seen kills, apart from the
 * win-rate records above them. `undefined` means the counters have not answered yet and `null` means
 * they could not be read; neither is "not enough data", which is a real answer.
 */
export function buildCountersKillFeedView(
  kills: CommunityKills | null | undefined,
  identities: HeroIdentities,
): CountersKillFeedView {
  if (kills === undefined) {
    return { kind: 'loading' };
  }

  if (kills === null) {
    return { kind: 'unavailable' };
  }

  const pairs = topKillPairs(kills, COUNTERS_TAB_KILL_PAIRS);

  if (pairs.length === 0) {
    return {
      kind: 'not-enough-data',
      summary: `No hero has been seen killing another often enough yet. ${killPairMinimum(kills)}`,
    };
  }

  const halfSeasonLabel = kills.halfSeason?.label ?? null;

  return {
    kind: 'ready',
    halfSeasonLabel,
    notice: kills.inPlaceOf === null ? null : halfSeasonFallbackNotice(kills.inPlaceOf.label, halfSeasonLabel),
    pairs: pairs.map((pair) => {
      const killer = heroCell(pair.killer, identities);
      const victim = heroCell(pair.victim, identities);

      return {
        key: `${pair.killer}>${pair.victim}`,
        killer: { hero: killer.hero, name: killer.name, imageUrl: killer.imageUrl },
        victim: { hero: victim.hero, name: victim.name, imageUrl: victim.imageUrl },
        band: killsBandLabel(pair.killsBand),
        description: killPairSentence(pair, killer.name, victim.name),
      };
    }),
  };
}
