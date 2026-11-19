import { InjectionToken, type Type } from '@angular/core';

export interface AdminPage {
  /** The page's address under `/admin`, and so the link in the menu. */
  path: string;
  label: string;
  loadComponent: () => Promise<Type<unknown>>;
}

/**
 * Every page of the admin area, in menu order. The menu and the routes both come from this list, so
 * adding a page is one entry here and its component; neither the shell nor the routes change.
 */
export const ADMIN_PAGES: readonly AdminPage[] = [
  {
    path: 'overview',
    label: 'Overview',
    loadComponent: () => import('./overview/admin-overview.component').then((module) => module.AdminOverviewComponent),
  },
  {
    path: 'data-jobs',
    label: 'Data jobs',
    loadComponent: () => import('./data-jobs/data-jobs-page.component').then((module) => module.DataJobsPageComponent),
  },
];

/** What the shell shows. It is the list above; a test provides another to prove the shell follows it. */
export const ADMIN_PAGE_LIST = new InjectionToken<readonly AdminPage[]>('ADMIN_PAGE_LIST', {
  providedIn: 'root',
  factory: () => ADMIN_PAGES,
});
