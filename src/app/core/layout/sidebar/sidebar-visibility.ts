import { isPlatformServer } from '@angular/common';
import { Injectable, PLATFORM_ID, TransferState, inject, makeStateKey } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Data, NavigationEnd, Router } from '@angular/router';
import { filter, map, tap } from 'rxjs';

/** Route `data` for a page that has no sidebar. Pages have one unless their route spreads this in. */
export const ROUTE_WITHOUT_SIDEBAR: Data = { sidebar: false };

/** What the server decided for the page it rendered, so the browser's first render agrees with it. */
export const SIDEBAR_VISIBLE_STATE = makeStateKey<boolean>('sidebar-visible');

/**
 * Whether the page the router is on gets the sidebar, read from the `data` of its route and every
 * parent.
 *
 * The router has not resolved a route when the app first renders, so there is nothing to read yet.
 * The browser starts from what the server decided (sent in `TransferState`); with none, as on the
 * client-rendered account pages, it starts hidden and shows the sidebar together with the page.
 * Starting visible instead would flash the sidebar on the home page. Blocking the first navigation
 * would avoid this too, but it would hold the whole app back on the account routes' sign-in check.
 */
@Injectable({ providedIn: 'root' })
export class SidebarVisibility {
  private readonly router = inject(Router);
  private readonly transferState = inject(TransferState);
  private readonly onServer = isPlatformServer(inject(PLATFORM_ID));

  readonly visible = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.read()),
      tap((visible) => {
        if (this.onServer) {
          this.transferState.set(SIDEBAR_VISIBLE_STATE, visible);
        }
      }),
    ),
    { initialValue: this.transferState.get(SIDEBAR_VISIBLE_STATE, false) },
  );

  private read(): boolean {
    for (let route = this.router.routerState.snapshot.root; ; route = route.firstChild) {
      if (route.routeConfig?.data?.['sidebar'] === false) {
        return false;
      }

      if (!route.firstChild) {
        return true;
      }
    }
  }
}
