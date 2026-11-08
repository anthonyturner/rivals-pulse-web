import { RenderMode } from '@angular/ssr';

import { serverRoutes } from './app.routes.server';
import { PULSE_RECORDS_PAGES } from './features/records/pulse-records.data';

describe('serverRoutes', () => {
  for (const path of ['sign-in', 'account', 'profile', 'admin', 'admin/**', 'records']) {
    it(`renders ${path} in the browser only`, () => {
      expect(serverRoutes.find((route) => route.path === path)?.renderMode).toBe(RenderMode.Client);
    });
  }

  it('renders each Pulse Records list in the browser only, so no name is baked into server HTML', () => {
    for (const page of PULSE_RECORDS_PAGES) {
      expect(serverRoutes.find((route) => route.path === `records/${page.slug}`)?.renderMode).toBe(RenderMode.Client);
    }
  });

  it('server-renders an unknown list, so it gets the 404 page and status', () => {
    expect(serverRoutes.some((route) => route.path === 'records/**')).toBeFalse();
    expect(serverRoutes.find((route) => route.path === '**')?.renderMode).toBe(RenderMode.Server);
  });

  it('keeps server rendering for the rest of the site', () => {
    expect(serverRoutes.find((route) => route.path === '**')?.renderMode).toBe(RenderMode.Server);
  });
});
