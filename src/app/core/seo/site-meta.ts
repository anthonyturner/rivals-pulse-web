/**
 * The site-wide values behind the page title, description and link-preview
 * tags. `src/index.html` repeats them as static tags so a crawler that does not
 * run JavaScript still sees them; `scripts/index-html-meta.test.ts` fails if
 * the two drift apart. Keep this file free of imports so that test can load it.
 */

/** Fixed production origin, so a deploy preview never becomes a canonical URL. */
export const SITE_ORIGIN = 'https://rivalspulse.com';

export const SITE_NAME = 'RivalsPulse';

export const HOME_TITLE = 'RivalsPulse | Feel the pulse of every match';

export const SITE_DESCRIPTION =
  'RivalsPulse is a free Marvel Rivals stats app: live stats on your screen and counters at your fingertips, with win rates and tier lists from real matches.';

/** Interim 1200x630 text card; the maintainer may replace this file with a gameplay screenshot. */
export const PREVIEW_IMAGE_PATH = '/images/site/og-preview.png';

export const PREVIEW_IMAGE_WIDTH = 1200;

export const PREVIEW_IMAGE_HEIGHT = 630;

export const PREVIEW_IMAGE_ALT = 'RivalsPulse: Feel the pulse of every match.';
