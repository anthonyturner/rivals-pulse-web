import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { buildHeroesTabView } from '../../community/heroes-tab/heroes-tab-view';
import type { CommunityHeroRow } from '../../community/community-hero-list/community-hero-list.component';
import type { HeroIdentities } from '../hero-identity';

/** One leading hero with the words that frame it. */
export interface HeroSpotlightView {
  heading: string;
  figureLabel: string;
  hero: CommunityHeroRow;
}

/**
 * - `loading`: the hero numbers or the roster have not answered, so the tiles' room is held.
 * - `none`: the numbers could not be read, or no hero has reached the minimum yet; no tile is drawn.
 * - `ready`: the hero picked most and the hero that wins most, among the heroes placed on the Heroes tab.
 */
export type HeroSpotlightsView =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'ready'; spotlights: [HeroSpotlightView, HeroSpotlightView] };

/**
 * The Stats overview's two leading heroes. They are the first of the Heroes tab's own lists, so the
 * overview and that tab can never name different heroes. `undefined` is a request still running and
 * `null` one that failed.
 */
export function buildHeroSpotlightsView(
  stats: HeroStats | null | undefined,
  identities: HeroIdentities,
): HeroSpotlightsView {
  if (stats === undefined) {
    return { kind: 'loading' };
  }

  const tab = buildHeroesTabView(stats, identities);

  if (tab.kind !== 'ready' || tab.mostPicked.length === 0 || tab.highestWinRate.length === 0) {
    return { kind: 'none' };
  }

  return {
    kind: 'ready',
    spotlights: [
      { heading: 'Most picked', figureLabel: 'pick rate', hero: tab.mostPicked[0] },
      { heading: 'Highest win rate', figureLabel: 'win rate', hero: tab.highestWinRate[0] },
    ],
  };
}
