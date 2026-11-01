/**
 * The site-wide values behind the page title, description and link-preview
 * tags. `src/index.html` repeats them as static tags so a crawler that does not
 * run JavaScript still sees them; `scripts/index-html-meta.test.ts` fails if
 * the two drift apart. Keep this file free of imports so that test can load it.
 */

/** Fixed production origin, so a deploy preview never becomes a canonical URL. */
export const SITE_ORIGIN = 'https://rivalspulse.com';

export const SITE_NAME = 'RivalsPulse';

export const HOME_TITLE = 'RivalsPulse | Know every match before it starts';

export const SITE_DESCRIPTION =
  'A free Overwolf app for Marvel Rivals: live stats on your screen and counters at your fingertips. Hero win rates, counters and tier lists counted from real matches players recorded, plus hero guides and a team builder.';

/** Interim 1200x630 text card; the maintainer may replace this file with a gameplay screenshot. */
export const PREVIEW_IMAGE_PATH = '/images/site/og-preview.png';

export const PREVIEW_IMAGE_WIDTH = 1200;

export const PREVIEW_IMAGE_HEIGHT = 630;

export const PREVIEW_IMAGE_ALT = 'RivalsPulse: Know every match before it starts.';
