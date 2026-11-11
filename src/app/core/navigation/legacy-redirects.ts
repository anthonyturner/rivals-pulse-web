/**
 * Stat addresses that moved into the Stats hub. This file is the one list of them: the router
 * redirects (`legacy-redirect.routes.ts`) and the permanent redirects in `vercel.json` are both
 * checked against it, so the two cannot drift apart. Keep it free of imports so the scripts that
 * test `vercel.json` can load it outside Angular.
 */
export interface LegacyRedirect {
  /** The old address, with no query. */
  readonly from: string;
  /** Where it goes, straight at the new page. */
  readonly to: string;
}

/**
 * The old Community page had a tab per figure. Matches and Insights are sections of the Stats
 * overview, and the tier list tab becomes the Heroes tab with the rest of the hero numbers.
 */
const COMMUNITY_REDIRECTS: readonly LegacyRedirect[] = [
  { from: '/community', to: '/stats' },
  { from: '/community/heroes', to: '/stats/heroes' },
  { from: '/community/tier-list', to: '/stats/heroes?view=tiers' },
  { from: '/community/matches', to: '/stats' },
  { from: '/community/insights', to: '/stats' },
  { from: '/community/counters', to: '/stats/matchups' },
  { from: '/community/stats', to: '/stats/roles' },
];

/**
 * Each Pulse Records list is now a choice in the Records tab's category filter. The slugs are those
 * of `PULSE_RECORDS_PAGES`, which the router spec checks, because that file is not loadable by the
 * scripts that read this one.
 */
const RECORDS_SLUGS = ['kills', 'assists', 'final-hits', 'damage', 'healing', 'damage-blocked'];

const RECORDS_REDIRECTS: readonly LegacyRedirect[] = [
  { from: '/records', to: '/stats/records' },
  ...RECORDS_SLUGS.map((slug) => ({ from: `/records/${slug}`, to: `/stats/records?category=${slug}` })),
];

/**
 * The tier list and the hero stats table were pages of their own; they are now the Tiers and Table
 * views of the Heroes tab. The win-rates page showed only the latest half-season, so a half-season
 * segment after `/win-rates` has nothing to carry over and goes to the tab's current numbers.
 */
const HERO_STATS_REDIRECTS: readonly LegacyRedirect[] = [
  { from: '/tier-list', to: '/stats/heroes?view=tiers' },
  { from: '/win-rates', to: '/stats/heroes' },
  { from: '/season-9-win-rates', to: '/stats/heroes' },
];

export const LEGACY_REDIRECTS: readonly LegacyRedirect[] = [
  ...COMMUNITY_REDIRECTS,
  ...HERO_STATS_REDIRECTS,
  { from: '/game-stats', to: '/stats' },
  { from: '/team-comps', to: '/stats/team-comps' },
  ...RECORDS_REDIRECTS,
];

/**
 * Any other address under these prefixes goes to the one page. The old community router sent an
 * unknown tab to the default tab, so it never answered a 404, and `/win-rates/:season` took any
 * segment.
 */
export const LEGACY_REDIRECT_PREFIXES: readonly LegacyRedirect[] = [
  { from: '/community', to: '/stats' },
  { from: '/win-rates', to: '/stats/heroes' },
];
