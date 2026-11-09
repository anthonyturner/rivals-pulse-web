import { APP_BASE_HREF } from '@angular/common';
import { mergeApplicationConfig } from '@angular/core';
// Private Angular API: there is no public way to read the server route table from a unit test.
// If an upgrade breaks it, look at how `traverseRoutesConfig` in @angular/ssr builds the tree.
import { ɵextractRoutesAndCreateRouteTree as extractRoutesAndCreateRouteTree } from '@angular/ssr';
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../../app';
import { config } from '../../app.config.server';
import { serverRenderSandbox } from '../../testing/server-render';
import { COMMUNITY_TABS, DEFAULT_COMMUNITY_TAB_ID } from './community-tabs';

/**
 * Builds the route tree the server render matches every request against, from the real
 * routes. The server answers a matched route's `redirectTo` with a 302 before rendering anything.
 */
async function buildServerRouteTree() {
  const indexHtml = '<html><body><app-root></app-root></body></html>';
  const { routeTree, errors } = await extractRoutesAndCreateRouteTree({
    url: new URL('http://localhost/'),
    manifest: {
      baseHref: '/',
      assets: {
        'index.server.html': {
          text: async () => indexHtml,
          hash: 'spec',
          size: indexHtml.length,
        },
      },
      bootstrap: async () => (context) => bootstrapApplication(App, mergeApplicationConfig(config, { providers: [{ provide: APP_BASE_HREF, useValue: '/' }] }), context),
    },
  });

  return { routeTree, errors };
}

describe('Community routes on the server', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('builds the server route tree without errors', async () => {
    const { errors } = await buildServerRouteTree();

    expect(errors).toEqual([]);
  });

  for (const tab of COMMUNITY_TABS) {
    it(`renders /community/${tab.id} instead of redirecting`, async () => {
      const { routeTree } = await buildServerRouteTree();

      const match = routeTree.match(`/community/${tab.id}`);

      expect(match).toBeDefined();
      expect(match?.redirectTo).toBeUndefined();
    });
  }

  it('still sends a longer, unknown address under /community to the default tab', async () => {
    const { routeTree } = await buildServerRouteTree();

    expect(routeTree.match('/community/not-a-tab/extra')?.redirectTo).toBe(`/community/${DEFAULT_COMMUNITY_TAB_ID}`);
  });
});
