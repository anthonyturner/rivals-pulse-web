import { RenderMode, ServerRoute } from '@angular/ssr';

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
    path: 'records/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
