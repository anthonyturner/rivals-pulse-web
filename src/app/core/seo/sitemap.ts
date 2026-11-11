/**
 * Which pages the sitemap lists. `scripts/write-sitemap.ts` turns this into `sitemap.xml` at build
 * time, and `sitemap.spec.ts` fails when a route in `app.routes.ts` is in neither list below, so a
 * new page is always a decision rather than an omission. A route that only redirects (the old stat
 * addresses in `legacy-redirects.ts`) is in neither list: it is never listed, so a crawler is not
 * sent to an address that answers with a redirect. Keep this file free of imports so that
 * script, which runs outside Angular, can load it.
 */

/**
 * Content pages with a fixed address. A data page is listed only at its Stats hub address, and only
 * when the server renders it: it then reads as a full page, and one that has too little data asks
 * not to be indexed (thin content) so listing it does no harm, as the Maps tab does until one map
 * has a win rate. Records is drawn in the browser, so it is not listed.
 */
export const SITEMAP_STATIC_PATHS: readonly string[] = [
  '/',
  '/heroes',
  '/hero-guides',
  '/hero-guides/first-time',
  '/strategist-guides',
  '/glossary',
  '/techniques',
  '/beginner-interactive-guide',
  '/build-theory',
  '/triple-support-counter',
  '/power-positions',
  '/strategic-cover',
  '/how-we-count',
  '/faq',
  '/fair-play',
  '/privacy',
  '/stats',
  '/stats/heroes',
  '/stats/roles',
  '/stats/matchups',
  '/stats/maps',
  '/stats/team-comps',
  '/privacy/app',
];

/** Routes with an id in the address; the build lists one page per id in the content data. */
export const SITEMAP_ID_ROUTES = {
  hero: '/heroes/',
  heroGuide: '/hero-guides/',
  strategistGuide: '/strategist-guides/',
} as const;

/**
 * Routes left out on purpose, with the reason. A path ending in `/` stands for every route under it.
 * The Records tab is out because it is drawn in the browser, where its player names stay out of the
 * server's HTML.
 */
export const SITEMAP_EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  resources: 'hub of links to other pages',
  tools: 'hub of links to other pages',
  'user-highlights': 'player-submitted clips, not written content',
  'media-tutorials': 'a list of embedded videos with little text of its own',
  'learning-paths': 'not released yet (released-page guard)',
  'watch-next': 'not released yet (released-page guard)',
  counters: 'interactive tool with no text of its own',
  'dive-planner': 'interactive tool with no text of its own',
  'team-builder': 'interactive tool with no text of its own',
  'sign-in': 'account page',
  account: 'account page',
  profile: 'account page',
  admin: 'admin page',
};

export interface SitemapContent {
  origin: string;
  heroIds: readonly string[];
  heroGuideIds: readonly string[];
  strategistGuideIds: readonly string[];
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Every sitemap address for the given content, in a stable order and without repeats. */
export function listSitemapPaths(content: Omit<SitemapContent, 'origin'>): string[] {
  const idPages = (prefix: string, ids: readonly string[]): string[] =>
    ids.map((id) => `${prefix}${encodeURIComponent(id)}`);

  return [
    ...new Set([
      ...SITEMAP_STATIC_PATHS,
      ...idPages(SITEMAP_ID_ROUTES.hero, content.heroIds),
      ...idPages(SITEMAP_ID_ROUTES.heroGuide, content.heroGuideIds),
      ...idPages(SITEMAP_ID_ROUTES.strategistGuide, content.strategistGuideIds),
    ]),
  ];
}

export function renderSitemapXml(content: SitemapContent): string {
  const entries = listSitemapPaths(content).map(
    (path) => `  <url><loc>${escapeXml(content.origin + path)}</loc></url>`,
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}
