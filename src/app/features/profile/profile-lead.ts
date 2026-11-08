import type { DashboardResult } from '../../core/auth/auth.service';
import { countLabel, percentLabel } from '../../shared/utilities/stat-labels';
import type { TileChip, TileImageFit } from '../hub/hub-tile.types';
import { heroCell, type HeroIdentities } from '../insights/hero-identity';

export interface ProfileLead {
  title: string;
  description: string;
  chip: TileChip | null;
  imageUrl: string;
  imageFit: TileImageFit;
}

export const GENERIC_PROFILE_LEAD: ProfileLead = {
  title: 'Your matches, hero by hero',
  description: 'Wins, heroes and habits, worked out from the games your desktop app uploads.',
  chip: null,
  imageUrl: '/images/site/banners/my-stats-banner.webp',
  imageFit: 'cover',
};

const MOST_PLAYED_CHIP: TileChip = { kind: 'accent', label: 'Most played' };

/**
 * The page's lead tile. It is the player's most-played hero only for a linked player with matches
 * and a known hero, once the roster has arrived; every other state gets the generic art. The win
 * rate is left out, not drawn as a zero, when none of the hero's matches has a recorded result.
 */
export function profileLead(result: DashboardResult | undefined, identities: HeroIdentities | undefined): ProfileLead {
  if (result?.status !== 'ready' || !result.dashboard.linked || identities === undefined) {
    return GENERIC_PROFILE_LEAD;
  }

  const mostPlayed = result.dashboard.stats.topHeroes[0];

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
