import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ADMIN_PAGE_LIST, ADMIN_PAGES, type AdminPage } from '../admin-pages';
import { adminRoutesFor } from '../admin.routes';

@Component({
  selector: 'app-extra-admin-page',
  template: '<p>An extra admin page</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ExtraAdminPageComponent {}

const EXTRA_PAGE: AdminPage = {
  path: 'extra',
  label: 'Extra settings',
  loadComponent: async () => ExtraAdminPageComponent,
};

describe('the admin shell', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  async function open(url: string, pages: readonly AdminPage[]): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'admin', children: adminRoutesFor(pages) }]),
        { provide: ADMIN_PAGE_LIST, useValue: pages },
      ],
    });
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
  }

  const host = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const menu = (): HTMLAnchorElement[] =>
    Array.from(host().querySelectorAll<HTMLAnchorElement>('nav[aria-label="Admin pages"] a'));

  it('lists the pages of the admin area in a labelled menu and shows the first by default', async () => {
    await open('/admin', ADMIN_PAGES);

    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Admin');
    expect(menu().map((link) => link.textContent?.trim())).toEqual(ADMIN_PAGES.map((page) => page.label));
    expect(router.url).toBe(`/admin/${ADMIN_PAGES[0].path}`);
    expect(host().textContent).toContain('You are signed in as an administrator');
  });

  it('marks the page that is open in the menu', async () => {
    await open('/admin/overview', ADMIN_PAGES);

    expect(menu()[0].getAttribute('aria-current')).toBe('page');
  });

  it('sends an address under /admin that is no page to the first page', async () => {
    await open('/admin/nothing/here', ADMIN_PAGES);

    expect(router.url).toBe(`/admin/${ADMIN_PAGES[0].path}`);
  });

  it('shows a page added to the list, and opens it, with no change to the shell or the routes', async () => {
    await open('/admin/extra', [...ADMIN_PAGES, EXTRA_PAGE]);

    expect(menu().map((link) => link.textContent?.trim())).toEqual([
      ...ADMIN_PAGES.map((page) => page.label),
      'Extra settings',
    ]);
    expect(host().textContent).toContain('An extra admin page');
    expect(menu()[1].getAttribute('aria-current')).toBe('page');
    expect(menu()[0].getAttribute('aria-current')).toBeNull();
  });

  it('links each menu entry to its page under /admin', async () => {
    await open('/admin', [...ADMIN_PAGES, EXTRA_PAGE]);

    expect(menu().map((link) => link.getAttribute('href'))).toEqual(['/admin/overview', '/admin/extra']);
  });
});
