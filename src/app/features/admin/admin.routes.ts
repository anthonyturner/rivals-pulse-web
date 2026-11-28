import type { Routes } from '@angular/router';

import { ADMIN_PAGES, type AdminPage } from './admin-pages';
import { AdminShellComponent } from './shell/admin-shell.component';

/** The shell with one child route per page, and any other address under `/admin` sent to the first page. */
export function adminRoutesFor(pages: readonly AdminPage[]): Routes {
  const [first] = pages;

  return [
    {
      path: '',
      component: AdminShellComponent,
      children: [
        ...pages.map((page) => ({
          path: page.path,
          title: `${page.label} | Admin | RivalsPulse`,
          loadComponent: page.loadComponent,
        })),
        { path: '**', redirectTo: first.path },
      ],
    },
  ];
}

export const adminRoutes: Routes = adminRoutesFor(ADMIN_PAGES);
