/**
 * Which pages the sitemap lists. `scripts/write-sitemap.ts` turns this into `sitemap.xml` at build
 * time, and `sitemap.spec.ts` fails when a route in `app.routes.ts` is in neither list below, so a
 * new page is always a decision rather than an omission. Keep this file free of imports so that
 * script, which runs outside Angular, can load it.
 */

/**
 * Content pages with a fixed address. The Stats hub lists each tab that has content of its own; the
 * Heroes and Maps tabs are stand-ins that ask not to be indexed, so they join when they have content.
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
  '/stats/roles',
  '/stats/matchups',
  '/stats/team-comps',
  '/stats/records',
];

/** Routes with an id in the address; the build lists one page per id in the content data. */
export const SITEMAP_ID_ROUTES = {
  hero: '/heroes/',
  heroGuide: '/hero-guides/',
  strategistGuide: '/strategist-guides/',
} as const;

/**
 * Routes left out on purpose, with the reason. A path ending in `/` stands for every route under it.
 * The data pages are out because whether one has enough matches to show is only known when it
 * loads, so the build cannot tell a full page from a "not enough data yet" one.
 */
export const SITEMAP_EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  resources: 'hub of links to other pages',
  tools: 'hub of links to other pages',
  community: 'data tabs; their minimum is only known at runtime',
  'user-highlights': 'player-submitted clips, not written content',
  'media-tutorials': 'a list of embedded videos with little text of its own',
  'learning-paths': 'not released yet (released-page guard)',
  'watch-next': 'not released yet (released-page guard)',
  'game-stats': 'data page; its minimum is only known at runtime',
  'tier-list': 'data page; its minimum is only known at runtime',
  'win-rates': 'data page; its minimum is only known at runtime',
  'win-rates/:season': 'data page; its minimum is only known at runtime',
  'team-comps': 'data page; its minimum is only known at runtime',
  records: 'data page; its minimum is only known at runtime',
  'records/': 'data page; its minimum is only known at runtime',
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
