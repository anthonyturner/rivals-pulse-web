/**
 * The site-wide values behind the page title, description and link-preview
 * tags. `src/index.html` repeats them as static tags so a crawler that does not
 * run JavaScript still sees them; `scripts/index-html-meta.test.ts` fails if
 * the two drift apart. Keep this file free of imports so that test can load it.
 */

/** Fixed production origin, so a deploy preview never becomes a canonical URL. */
export const SITE_ORIGIN = 'https://rivalspulse.com';

export const SITE_NAME = 'Rivals Pulse Coach';

export const HOME_TITLE = 'Rivals Pulse Coach | Marvel Rivals hero stats and coaching';

export const SITE_DESCRIPTION =
  'Marvel Rivals coaching built on real matches: hero win rates, counters and tier lists from the Rivals Pulse overlay, plus hero guides and a team builder.';

/** Placeholder until the final 1200x630 image replaces the file at this path. */
export const PREVIEW_IMAGE_PATH = '/images/site/og-preview-placeholder.png';

export const PREVIEW_IMAGE_WIDTH = 1200;

export const PREVIEW_IMAGE_HEIGHT = 630;

export const PREVIEW_IMAGE_ALT = 'Rivals Pulse Coach: Draft smarter. Fight cleaner.';
