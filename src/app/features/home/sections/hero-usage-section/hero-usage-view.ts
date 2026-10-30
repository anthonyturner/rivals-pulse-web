import type { HeroStats } from '../../../../../contracts/hero-stats.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../../shared/utilities/stat-labels';
import { heroCell, type HeroCell, type HeroIdentities } from '../../../insights/hero-identity';

/** How many heroes the section shows. A hero short of the minimum does not take one of these. */
export const HERO_USAGE_SLOTS = 5;

export interface HeroUsageCardView extends HeroCell {
  pickRateLabel: string;
  winRateLabel: string;
  /** Scoreboard lines of this hero, written compactly: 1,800 is "1.8K". */
  appearancesLabel: string;
}

export interface HeroUsageView {
  /** `unavailable`: the numbers could not be read. `empty`: no hero has enough data to show yet. */
  state: 'ready' | 'empty' | 'unavailable';
  /** The label every state carries, such as "Based on Rivals Pulse players - 146 matches, Season 10.5". */
  sourceLabel: string;
  fallbackNotice: string | null;
  /** What the notice says when `state` is `empty`. */
  emptyMessage: string;
  cards: HeroUsageCardView[];
  /** How many empty slots follow the cards, so a partial list keeps the grid of a full one. */
  placeholderSlots: number;
}

const SOURCE = 'Based on Rivals Pulse players';

/**
 * The most-picked heroes among those with enough data. `stats` is null when they could not be read,
 * which is shown as a notice too: the home page never has a blank panel or a figure it could not compute.
 */
export function buildHeroUsageView(stats: HeroStats | null, identities: HeroIdentities): HeroUsageView {
  if (stats === null) {
    return {
      state: 'unavailable',
      sourceLabel: SOURCE,
      fallbackNotice: null,
      emptyMessage: 'Hero usage cannot be loaded right now. The rest of the page is not affected.',
      cards: [],
      placeholderSlots: 0,
    };
  }

  const cards = stats.tiers
    .flatMap((tier) => tier.heroes)
    .filter((hero) => Number.isFinite(hero.pickRate) && Number.isFinite(hero.winRate) && hero.appearances > 0)
    .sort((a, b) => b.pickRate - a.pickRate || b.appearances - a.appearances || a.hero.localeCompare(b.hero))
    .slice(0, HERO_USAGE_SLOTS)
    .map(
      (hero): HeroUsageCardView => ({
        ...heroCell(hero.hero, identities),
        pickRateLabel: percentLabel(hero.pickRate),
        winRateLabel: percentLabel(hero.winRate),
        appearancesLabel: compactCount(hero.appearances),
      }),
    );
  const season = stats.halfSeason?.label;

  return {
    state: cards.length > 0 ? 'ready' : 'empty',
    sourceLabel: [SOURCE, countLabel(stats.matchesCounted, 'match', 'matches'), season]
      .filter((part) => part !== undefined)
      .join(' · '),
    fallbackNotice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, season ?? null),
    emptyMessage: `Not enough data yet. A hero appears here once Rivals Pulse players have recorded ${stats.minimumMatches} appearances of it.`,
    cards,
    placeholderSlots: cards.length > 0 ? HERO_USAGE_SLOTS - cards.length : 0,
  };
}

function compactCount(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
