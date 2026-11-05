import { RenderMode } from '@angular/ssr';

import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  for (const path of ['sign-in', 'account', 'profile', 'admin', 'admin/**']) {
    it(`renders ${path} in the browser only`, () => {
      expect(serverRoutes.find((route) => route.path === path)?.renderMode).toBe(RenderMode.Client);
    });
  }

  it('keeps server rendering for the rest of the site', () => {
    expect(serverRoutes.find((route) => route.path === '**')?.renderMode).toBe(RenderMode.Server);
  });
});
