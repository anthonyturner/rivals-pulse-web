import { RenderMode, ServerRoute } from '@angular/ssr';

import { PULSE_RECORDS_PAGES } from './features/records/pulse-records.data';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'sign-in',
    renderMode: RenderMode.Client
  },
  {
    path: 'account',
    renderMode: RenderMode.Client
  },
  {
    path: 'profile',
    renderMode: RenderMode.Client
  },
  {
    path: 'admin',
    renderMode: RenderMode.Client
  },
  {
    path: 'admin/**',
    renderMode: RenderMode.Client
  },
  {
    path: 'records',
    renderMode: RenderMode.Client
  },
  {
    path: 'stats/records',
    renderMode: RenderMode.Client
  },
  // Only the known lists, so an unknown one falls through to the server-rendered page and its 404 status.
  ...PULSE_RECORDS_PAGES.map((page): ServerRoute => ({
    path: `records/${page.slug}`,
    renderMode: RenderMode.Client
  })),
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
