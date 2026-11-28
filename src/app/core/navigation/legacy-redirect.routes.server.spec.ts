import { APP_BASE_HREF } from '@angular/common';
import { mergeApplicationConfig } from '@angular/core';
// Private Angular API: there is no public way to read the server route table from a unit test.
// If an upgrade breaks it, look at how `traverseRoutesConfig` in @angular/ssr builds the tree.
import { ɵextractRoutesAndCreateRouteTree as extractRoutesAndCreateRouteTree } from '@angular/ssr';
import { bootstrapApplication } from '@angular/platform-browser';

import { App } from '../../app';
import { config } from '../../app.config.server';
import { serverRenderSandbox } from '../../testing/server-render';
import { LEGACY_REDIRECTS } from './legacy-redirects';

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

describe('The old stat addresses on the server', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('builds the server route tree without errors', async () => {
    const { errors } = await buildServerRouteTree();

    expect(errors).toEqual([]);
  });

  for (const { from, to } of LEGACY_REDIRECTS) {
    it(`redirects ${from} to ${to} instead of rendering it`, async () => {
      const { routeTree } = await buildServerRouteTree();

      expect(routeTree.match(from)?.redirectTo).toBe(to);
    });
  }

  it('sends any other address under /community to the Stats overview, never a 404', async () => {
    const { routeTree } = await buildServerRouteTree();

    expect(routeTree.match('/community/not-a-tab/extra')?.redirectTo).toBe('/stats');
  });

  it('sends a half-season after /win-rates to the Heroes tab, never a 404', async () => {
    const { routeTree } = await buildServerRouteTree();

    expect(routeTree.match('/win-rates/10.5')?.redirectTo).toBe('/stats/heroes');
    expect(routeTree.match('/win-rates/9/extra')?.redirectTo).toBe('/stats/heroes');
  });

  it('still answers an unknown Pulse Records list with the not-found page', async () => {
    const { routeTree } = await buildServerRouteTree();

    expect(routeTree.match('/records/speed')?.redirectTo).toBeUndefined();
  });
});
