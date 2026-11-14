import type { Route } from '@angular/router';

import { routes } from '../../app.routes';
import { STATS_TABS, statsTabLink } from '../../features/stats/stats-tabs';
import { LEGACY_REDIRECTS } from '../navigation/legacy-redirects';
import { NAVIGATION_CATEGORIES } from '../navigation/navigation-category.data';
import {
  listSitemapPaths,
  renderSitemapXml,
  SITEMAP_EXCLUDED_ROUTES,
  SITEMAP_ID_ROUTES,
  SITEMAP_STATIC_PATHS,
} from './sitemap';

const onlyRedirects = (route: Route): boolean =>
  route.redirectTo !== undefined || ((route.children?.length ?? 0) > 0 && route.children?.every(onlyRedirects) === true);

/** The address of every route that answers a page: no redirects, and no catch-all. */
const pageRoutePaths = routes.flatMap((route) =>
  route.path === undefined || route.path === '**' || onlyRedirects(route) ? [] : [route.path],
);

function isExcluded(path: string): boolean {
  return Object.keys(SITEMAP_EXCLUDED_ROUTES).some(
    (excluded) => path === excluded || (excluded.endsWith('/') && path.startsWith(excluded)),
  );
}

function isListed(path: string): boolean {
  const address = path === '' ? '/' : `/${path}`;

  return (
    SITEMAP_STATIC_PATHS.includes(address) ||
    Object.values(SITEMAP_ID_ROUTES).some((prefix) => address.startsWith(`${prefix}:`))
  );
}

describe('sitemap', () => {
  it('has a decision for every page route, so a new page is listed or left out on purpose', () => {
    const undecided = pageRoutePaths.filter((path) => !isListed(path) && !isExcluded(path));

    expect(undecided).toEqual([]);
  });

  it('lists no address that only redirects to the Stats hub', () => {
    const listed = new Set(SITEMAP_STATIC_PATHS);

    expect(LEGACY_REDIRECTS.map(({ from }) => from).filter((from) => listed.has(from))).toEqual([]);
  });

  it('leaves out only routes that exist, so a page that moved takes its exclusion with it', () => {
    const stale = Object.keys(SITEMAP_EXCLUDED_ROUTES).filter(
      (excluded) => !pageRoutePaths.some((path) => path === excluded || (excluded.endsWith('/') && path.startsWith(excluded))),
    );

    expect(stale).toEqual([]);
  });

  it('lists no page the released-page guard hides', () => {
    const unreleased = NAVIGATION_CATEGORIES.flatMap((category) => category.items)
      .filter((item) => !item.enabled)
      .map((item) => item.path);

    expect(SITEMAP_STATIC_PATHS.filter((path) => unreleased.includes(path))).toEqual([]);
  });

  it('lists the desktop app privacy policy', () => {
    expect(SITEMAP_STATIC_PATHS).toContain('/privacy/app');
  });

  it('lists no account, admin or sign-in page', () => {
    const privatePaths = ['/admin', '/account', '/profile', '/sign-in'];

    expect(SITEMAP_STATIC_PATHS.filter((path) => privatePaths.includes(path))).toEqual([]);
  });

  it('lists only addresses a route answers', () => {
    const known = new Set(
      ['', ...pageRoutePaths, 'heroes'].map((path) => `/${path}`.replace('//', '/')).concat(STATS_TABS.map(statsTabLink)),
    );

    expect(SITEMAP_STATIC_PATHS.filter((path) => !known.has(path))).toEqual([]);
  });

  it('lists each Stats tab the server renders with content, and no browser-drawn tab', () => {
    const listedTabs = SITEMAP_STATIC_PATHS.filter((path) => path === '/stats' || path.startsWith('/stats/'));
    const serverRendered = STATS_TABS.filter((tab) => tab.hasContent && tab.id !== 'records');

    expect(listedTabs).toEqual(serverRendered.map(statsTabLink));
  });

  it('adds a page for each hero and guide in the content data', () => {
    const paths = listSitemapPaths({
      heroIds: ['storm'],
      heroGuideIds: ['storm'],
      strategistGuideIds: ['tempo'],
    });

    expect(paths).toEqual(
      jasmine.arrayContaining(['/heroes/storm', '/hero-guides/storm', '/strategist-guides/tempo']),
    );
  });

  it('renders absolute production URLs and escapes what an id could break', () => {
    const xml = renderSitemapXml({
      origin: 'https://rivalspulse.com',
      heroIds: ['a&b'],
      heroGuideIds: [],
      strategistGuideIds: [],
    });

    expect(xml).toContain('<loc>https://rivalspulse.com/</loc>');
    expect(xml).toContain('<loc>https://rivalspulse.com/heroes/a%26b</loc>');
    expect(xml).not.toContain('a&b');
  });
});
