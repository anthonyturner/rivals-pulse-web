import type { OwnHeroSummary } from '../../core/auth/own-dashboard.types';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';
import type { TileChip, TileImageFit } from '../hub/hub-tile.types';
import { heroCell, type HeroIdentities } from '../insights/hero-identity';

/** What the page's lead tile draws. */
export interface ProfileLead {
  title: string;
  description: string;
  chip: TileChip | null;
  imageUrl: string;
  imageFit: TileImageFit;
}

/** Page art for a visitor with no most-played hero to show. It names no hero and states no figure. */
export const GENERIC_PROFILE_LEAD: ProfileLead = {
  title: 'Your matches, hero by hero',
  description: 'Wins, heroes and habits, worked out from the games your desktop app uploads.',
  chip: null,
  imageUrl: '/images/site/banners/my-stats-banner.webp',
  imageFit: 'cover',
};

const MOST_PLAYED_CHIP: TileChip = { kind: 'accent', label: 'Most played' };

/**
 * The lead for the hero a player has played most, from their own matches only. The win rate is
 * left out, not drawn as a zero, when none of the hero's matches has a recorded result. Without a
 * hero the lead is the generic one.
 */
export function profileLead(mostPlayed: OwnHeroSummary | undefined, identities: HeroIdentities): ProfileLead {
  if (mostPlayed === undefined) {
    return GENERIC_PROFILE_LEAD;
  }

  const hero = heroCell(mostPlayed.hero, identities);
  const matches = countLabel(mostPlayed.matches, 'match', 'matches');

  return {
    title: hero.name,
    description: mostPlayed.winRate === null ? matches : `${matches}, ${percentLabel(mostPlayed.winRate * 100)} win rate`,
    chip: MOST_PLAYED_CHIP,
    imageUrl: hero.imageUrl,
    imageFit: 'portrait',
  };
}
