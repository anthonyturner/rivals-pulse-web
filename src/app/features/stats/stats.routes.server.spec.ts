import { APP_BASE_HREF } from '@angular/common';
import { mergeApplicationConfig } from '@angular/core';
// Private Angular API: there is no public way to read the server route table from a unit test.
// If an upgrade breaks it, look at how `traverseRoutesConfig` in @angular/ssr builds the tree.
import { ɵextractRoutesAndCreateRouteTree as extractRoutesAndCreateRouteTree, RenderMode } from '@angular/ssr';
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../../app';
import { config } from '../../app.config.server';
import { serverRenderSandbox } from '../../testing/server-render';
import { STATS_TABS, statsTabLink } from './stats-tabs';

/** Builds the route tree the server render matches every request against, from the real routes. */
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

describe('Stats routes on the server', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('builds the server route tree without errors', async () => {
    const { errors } = await buildServerRouteTree();

    expect(errors).toEqual([]);
  });

  for (const tab of STATS_TABS) {
    const address = statsTabLink(tab);
    // The Pulse Records lists name players, who must not be in server HTML (ADR-0006), so Records is drawn in the browser.
    const renderMode = tab.id === 'records' ? RenderMode.Client : RenderMode.Server;

    it(`renders ${address} on ${renderMode === RenderMode.Client ? 'the client' : 'the server'}, without redirecting`, async () => {
      const { routeTree } = await buildServerRouteTree();

      const match = routeTree.match(address);

      expect(match).toBeDefined();
      expect(match?.redirectTo).toBeUndefined();
      expect(match?.renderMode).toBe(renderMode);
    });
  }

  it('renders an address that names no tab on the server, where the router answers it with the not-found page', async () => {
    const { routeTree } = await buildServerRouteTree();

    const match = routeTree.match('/stats/nowhere');

    expect(match?.redirectTo).toBeUndefined();
    expect(match?.renderMode).toBe(RenderMode.Server);
  });
});
