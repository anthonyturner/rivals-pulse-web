import type { Route, Routes } from '@angular/router';

import { routes } from './app.routes';
import { HOME_TITLE, SITE_NAME } from './core/seo/site-meta';

interface RoutedPage {
  address: string;
  title: Route['title'];
}

/**
 * Every route that shows a page, with the title it ends up with. A route without a title of its
 * own takes the nearest parent's, which is how a lazy child file is covered by the route that loads it.
 */
async function routedPages(list: Routes, address: string, inherited: Route['title']): Promise<RoutedPage[]> {
  const pages: RoutedPage[] = [];

  for (const route of list) {
    const here = `${address}/${route.path ?? '(matcher)'}`;
    const title = route.title ?? inherited;

    if (route.redirectTo !== undefined) {
      continue;
    }

    if (route.component || route.loadComponent) {
      pages.push({ address: here, title });
    }

    pages.push(...(await routedPages(route.children ?? [], here, title)));

    if (typeof route.loadChildren === 'function') {
      const loaded = await route.loadChildren();

      if (!Array.isArray(loaded)) {
        throw new Error(`${here} loads children that are not a route list`);
      }

      pages.push(...(await routedPages(loaded, here, title)));
    }
  }

  return pages;
}

describe('page titles across the route config', () => {
  it('gives every routed page a title, so no browser tab or back link falls back to the bare site name', async () => {
    const pages = await routedPages(routes, '', undefined);
    const untitled = pages.filter((page) => !page.title).map((page) => page.address);

    expect(pages.length).toBeGreaterThan(40);
    expect(untitled).toEqual([]);
  });

  it('covers the generated category routes and the Stats hub tabs', async () => {
    const addresses = (await routedPages(routes, '', undefined)).map((page) => page.address);

    expect(addresses).toContain('/resources');
    expect(addresses).toContain('/tools');
    expect(addresses.map((address) => address.replace('//', '/'))).toContain('/stats/records');
    expect(addresses.some((address) => address.startsWith('/records'))).toBeFalse();
  });

  it('ends each fixed title in the site name, like the other pages', async () => {
    const pages = await routedPages(routes, '', undefined);
    const stray = pages
      .filter((page) => typeof page.title === 'string' && page.title !== HOME_TITLE)
      .filter((page) => !(page.title as string).endsWith(` | ${SITE_NAME}`))
      .map((page) => `${page.address}: ${page.title as string}`);

    expect(stray).toEqual([]);
  });
});
