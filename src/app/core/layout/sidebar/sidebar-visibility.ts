import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Data, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

/** Route `data` for a page that has no sidebar. Pages have one unless their route spreads this in. */
export const ROUTE_WITHOUT_SIDEBAR: Data = { sidebar: false };

/** Whether the page the router is on gets the sidebar, read from the `data` of its route and every parent. */
@Injectable({ providedIn: 'root' })
export class SidebarVisibility {
  private readonly router = inject(Router);

  readonly visible = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.read()),
    ),
    { initialValue: this.read() },
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
