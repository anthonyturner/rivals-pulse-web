import { RenderMode } from '@angular/ssr';

import { serverRoutes } from './app.routes.server';

describe('serverRoutes', () => {
  for (const path of ['sign-in', 'account', 'profile', 'admin', 'admin/**', 'stats/records']) {
    it(`renders ${path} in the browser only`, () => {
      expect(serverRoutes.find((route) => route.path === path)?.renderMode).toBe(RenderMode.Client);
    });
  }

  it('has no rule for the old /records addresses, so the server answers them with their redirect', () => {
    expect(serverRoutes.filter((route) => route.path === 'records' || route.path.startsWith('records/'))).toEqual([]);
  });

  it('keeps server rendering for the rest of the site', () => {
    expect(serverRoutes.find((route) => route.path === '**')?.renderMode).toBe(RenderMode.Server);
  });
});
