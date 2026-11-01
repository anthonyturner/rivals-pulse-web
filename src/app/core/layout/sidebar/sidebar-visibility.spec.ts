import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { ROUTE_WITHOUT_SIDEBAR, SidebarVisibility } from './sidebar-visibility';

@Component({ template: '' })
class PageComponent {}

const routes: Routes = [
  { path: '', component: PageComponent, data: ROUTE_WITHOUT_SIDEBAR },
  { path: 'heroes', component: PageComponent },
  {
    path: 'bare',
    data: ROUTE_WITHOUT_SIDEBAR,
    children: [{ path: 'child', component: PageComponent }],
  },
  { path: 'guides', children: [{ path: ':id', component: PageComponent }] },
];

describe('SidebarVisibility', () => {
  let router: Router;
  let visibility: SidebarVisibility;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter(routes)] });
    router = TestBed.inject(Router);
    visibility = TestBed.inject(SidebarVisibility);
  });

  it('hides the sidebar on the home page only', async () => {
    await router.navigateByUrl('/');
    expect(visibility.visible()).toBeFalse();

    await router.navigateByUrl('/heroes');
    expect(visibility.visible()).toBeTrue();

    await router.navigateByUrl('/guides/storm');
    expect(visibility.visible()).toBeTrue();

    await router.navigateByUrl('/');
    expect(visibility.visible()).toBeFalse();
  });

  it('follows a flag set on a parent route', async () => {
    await router.navigateByUrl('/bare/child');

    expect(visibility.visible()).toBeFalse();
  });
});
