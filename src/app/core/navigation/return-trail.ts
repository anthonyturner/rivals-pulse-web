import { DestroyRef, EnvironmentProviders, inject, Injectable, provideAppInitializer, signal } from '@angular/core';
import { NavigationEnd, Router, TitleStrategy, UrlTree } from '@angular/router';

import { SITE_NAME } from '../seo/site-meta';

/** A page the reader can go back to: its address and the name its title gives it. */
export interface ReturnPoint {
  readonly url: UrlTree;
  readonly label: string;
}

/**
 * Remembers the last page the reader was on outside a given area, so a detail view can offer a
 * link back to wherever the reader came from rather than only to its own index.
 *
 * It watches every finished navigation from app start (see `provideReturnTrail`), so it already
 * knows the earlier page when a detail view first asks. A page opened directly has no earlier page.
 */
@Injectable({ providedIn: 'root' })
export class ReturnTrail {
  private readonly router = inject(Router);
  private readonly titleStrategy = inject(TitleStrategy);
  private readonly last = signal<ReturnPoint | null>(null);
  private readonly previous = signal<ReturnPoint | null>(null);

  constructor() {
    const subscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.record(event.urlAfterRedirects);
      }
    });

    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /**
   * The last page visited before the reader entered the area at `pathPrefix` (such as `/heroes`),
   * or null when the reader started inside it or is not in it now. Moving around inside the area
   * keeps the same answer.
   */
  originOutside(pathPrefix: string): ReturnPoint | null {
    const last = this.last();

    return last && areaOf(last.url) === pathPrefix.replace(/^\//, '') ? this.previous() : null;
  }

  private record(url: string): void {
    const label = pageLabel(this.titleStrategy.buildTitle(this.router.routerState.snapshot));
    const point: ReturnPoint = { url: this.router.parseUrl(url), label };
    const last = this.last();

    // Inside one area the earlier page stays the one from before the area was entered.
    if (last && areaOf(last.url) !== areaOf(point.url)) {
      this.previous.set(last);
    }

    this.last.set(point);
  }
}

/** Starts the trail with the app, so it has seen the page before the first detail view asks. */
export function provideReturnTrail(): EnvironmentProviders {
  return provideAppInitializer(() => {
    inject(ReturnTrail);
  });
}

/** An area is the first path segment: `/heroes` and `/heroes/mantis` are one area. */
function areaOf(url: UrlTree): string {
  return url.root.children['primary']?.segments[0]?.path ?? '';
}

/** "Your stats | RivalsPulse" reads as "Your stats"; the home page's title leads with the site name. */
export function pageLabel(title: string | undefined): string {
  if (!title || title === SITE_NAME || title.startsWith(`${SITE_NAME} |`)) {
    return 'Home';
  }

  const suffix = ` | ${SITE_NAME}`;

  return title.endsWith(suffix) ? title.slice(0, -suffix.length) : title;
}
