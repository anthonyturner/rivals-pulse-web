import type { HeroStats } from '../../../../contracts/hero-stats.model';

export interface HeroTrustLineView {
  /** `counted` carries the match count; `neutral` is shown when there is no number worth stating. */
  state: 'counted' | 'neutral';
  text: string;
}

const NEUTRAL: HeroTrustLineView = { state: 'neutral', text: 'Counted from Rivals Pulse player uploads' };

/**
 * The line under the hero buttons. It names the half-season the count describes, which is the
 * previous one while it stands in for a current half-season still below the minimum. `stats` is
 * null when they could not be read; a count of zero is not stated, so no "0 matches" reaches the page.
 */
export function buildHeroTrustLine(stats: HeroStats | null): HeroTrustLineView {
  if (stats === null || !Number.isFinite(stats.matchesCounted) || stats.matchesCounted <= 0) {
    return NEUTRAL;
  }

  const matches = `${stats.matchesCounted.toLocaleString('en-US')} ${stats.matchesCounted === 1 ? 'match' : 'matches'} counted`;
  const season = stats.halfSeason?.label;

  return { state: 'counted', text: season ? `${matches} · ${season}` : matches };
}
