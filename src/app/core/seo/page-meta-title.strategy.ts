import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Data, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import {
  PREVIEW_IMAGE_ALT,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_PATH,
  PREVIEW_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
} from './site-meta';

/** Route `data` for a page that must stay out of search results and link previews. */
export const ROUTE_NOINDEX: Data = { noindex: true };

/** What a flagged page tells crawlers. Pages that add their own `noindex` tag use the bare word. */
const NOINDEX_CONTENT = 'noindex, nofollow';

/**
 * Keeps the page title and the link-preview tags in step with the route, on the
 * server and in the browser. A route's `title` becomes the page title and the
 * preview title; a route without one falls back to the site name. The
 * canonical URL is the production origin plus the route's own path, so no page
 * claims another page as its canonical. The exception is a page that asks not to
 * be indexed: it has no canonical, and the strategy tells by a `robots` tag with
 * `noindex` that the page added while the router activated it, before the title
 * is updated. `NotFoundComponent` adds that tag in its constructor and removes it
 * when destroyed; a page that adds the tag later would still get a canonical.
 *
 * A route that spreads `ROUTE_NOINDEX` into its `data` (the admin area) gets the same treatment from
 * here: this strategy adds `robots: noindex, nofollow` while the route is open and removes it on the
 * next page, and the page has no canonical. A parent route's flag covers its children.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  /** The robots tag this strategy added for a flagged route, so it removes only its own. */
  private flaggedTag: HTMLMetaElement | null = null;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? SITE_NAME;
    const url = canonicalUrl(snapshot.url);
    const image = `${SITE_ORIGIN}${PREVIEW_IMAGE_PATH}`;

    this.title.setTitle(title);
    this.setTags([
      { name: 'description', content: SITE_DESCRIPTION },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: title },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: String(PREVIEW_IMAGE_WIDTH) },
      { property: 'og:image:height', content: String(PREVIEW_IMAGE_HEIGHT) },
      { property: 'og:image:alt', content: PREVIEW_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: PREVIEW_IMAGE_ALT },
    ]);
    this.setRobots(asksNoIndex(snapshot));
    this.setCanonical(this.meta.getTag('name="robots"')?.content.startsWith('noindex') ? null : url);
  }

  private setRobots(noindex: boolean): void {
    if (noindex) {
      this.flaggedTag ??= this.meta.addTag({ name: 'robots', content: NOINDEX_CONTENT });
    } else if (this.flaggedTag) {
      this.meta.removeTagElement(this.flaggedTag);
      this.flaggedTag = null;
    }
  }

  private setTags(tags: { name?: string; property?: string; content: string }[]): void {
    for (const tag of tags) {
      this.meta.updateTag(tag);
    }
  }

  /** A page that asks not to be indexed has no canonical address to claim. */
  private setCanonical(url: string | null): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (url === null) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}

/** True when the route the router ended on, or any route above it, is flagged with `ROUTE_NOINDEX`. */
function asksNoIndex(snapshot: RouterStateSnapshot): boolean {
  for (let route = snapshot.root; ; route = route.firstChild) {
    if (route.routeConfig?.data?.['noindex'] === true) {
      return true;
    }

    if (!route.firstChild) {
      return false;
    }
  }
}

/** The page's own address on the production origin, without its query string or fragment. */
export function canonicalUrl(routerUrl: string): string {
  const path = routerUrl.split(/[?#]/)[0];
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
