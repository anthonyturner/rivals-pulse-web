import { Component, PLATFORM_ID, TransferState, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';

import { ROUTE_WITHOUT_SIDEBAR, SIDEBAR_VISIBLE_STATE, SidebarVisibility } from './sidebar-visibility';

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

  it('is hidden before the router has resolved a route, so a full load of home never shows it', () => {
    expect(visibility.visible()).toBeFalse();
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

describe('SidebarVisibility across the server and the browser', () => {
  function setUp(platform: 'server' | 'browser', transferred?: boolean): SidebarVisibility {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    if (transferred !== undefined) {
      TestBed.inject(TransferState).set(SIDEBAR_VISIBLE_STATE, transferred);
    }

    return TestBed.inject(SidebarVisibility);
  }

  it('starts the browser from what the server decided', () => {
    expect(setUp('browser', true).visible()).toBeTrue();
  });

  it('starts the browser hidden on the home page the server rendered', () => {
    expect(setUp('browser', false).visible()).toBeFalse();
  });

  it('records the server decision once the route is resolved, and only on the server', async () => {
    for (const [platform, url, expected] of [
      ['server', '/heroes', true],
      ['server', '/', false],
      ['browser', '/heroes', undefined],
    ] as const) {
      TestBed.resetTestingModule();
      setUp(platform);
      await TestBed.inject(Router).navigateByUrl(url);

      expect(TestBed.inject(TransferState).get(SIDEBAR_VISIBLE_STATE, undefined as unknown as boolean))
        .withContext(`${platform} ${url}`)
        .toBe(expected as boolean);
    }
  });
});
