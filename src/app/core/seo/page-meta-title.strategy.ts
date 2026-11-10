import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, Data, RouterStateSnapshot, TitleStrategy } from '@angular/router';

import {
  PREVIEW_IMAGE_ALT,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_PATH,
  PREVIEW_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
} from './site-meta';
import { ThinContent } from './thin-content';

/** Route `data` for a page that must stay out of search results and link previews. */
export const ROUTE_NOINDEX: Data = { noindex: true };

/** Route `data` key for a page's own meta description. A page without one uses the site-wide description. */
export const ROUTE_DESCRIPTION_KEY = 'description';

/** What a flagged route tells crawlers. A page that is merely thin asks only not to be indexed. */
const NOINDEX_CONTENT = 'noindex, nofollow';
const THIN_CONTENT = 'noindex';

/**
 * Keeps the page title and the link-preview tags in step with the route, on the
 * server and in the browser. A route's `title` becomes the page title and the
 * preview title; a route without one falls back to the site name. The
 * canonical URL is the production origin plus the route's own path, so no page
 * claims another page as its canonical. The exception is a page that asks not to
 * be indexed: it has no canonical, and the strategy tells by a `robots` tag with
 * `noindex` on the page.
 *
 * Two things ask for it, and this strategy owns the tag for both. A route that spreads
 * `ROUTE_NOINDEX` into its `data` (the admin area) gets `robots: noindex, nofollow`, and a parent
 * route's flag covers its children. A page that reports thin content (`ThinContent`: not-found,
 * or a data page below its minimum) gets `robots: noindex` for as long as it is thin, so the tag
 * and the canonical follow the page's data when it arrives after the navigation. Either goes on the
 * next page.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly thinContent = inject(ThinContent);
  /** The robots tag this strategy added, so it removes only its own. */
  private ownTag: HTMLMetaElement | null = null;
  /** The page the router is on; null until its first navigation ends. */
  private readonly page = signal<{ url: string; routeNoindex: boolean } | null>(null);

  constructor() {
    super();
    effect(() => this.applyIndexing());
    inject(DestroyRef).onDestroy(() => this.setRobots(null));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot) ?? SITE_NAME;
    const url = canonicalUrl(snapshot.url);
    const description = routeDescription(snapshot) ?? SITE_DESCRIPTION;
    const image = `${SITE_ORIGIN}${PREVIEW_IMAGE_PATH}`;

    this.title.setTitle(title);
    this.setTags([
      { name: 'description', content: description },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      { property: 'og:image:width', content: String(PREVIEW_IMAGE_WIDTH) },
      { property: 'og:image:height', content: String(PREVIEW_IMAGE_HEIGHT) },
      { property: 'og:image:alt', content: PREVIEW_IMAGE_ALT },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: PREVIEW_IMAGE_ALT },
    ]);
    this.page.set({ url, routeNoindex: asksNoIndex(snapshot) });
    this.applyIndexing();
  }

  /** Runs when the page changes, and again whenever its thin-content verdict does. */
  private applyIndexing(): void {
    const page = this.page();
    const thin = this.thinContent.thin();

    if (page === null) {
      return;
    }

    this.setRobots(page.routeNoindex ? NOINDEX_CONTENT : thin ? THIN_CONTENT : null);
    this.setCanonical(this.meta.getTag('name="robots"')?.content.startsWith('noindex') ? null : page.url);
  }

  private setRobots(content: string | null): void {
    if (content === null) {
      if (this.ownTag) {
        this.meta.removeTagElement(this.ownTag);
        this.ownTag = null;
      }

      return;
    }

    this.ownTag ??= this.meta.addTag({ name: 'robots', content }, true);
    this.ownTag?.setAttribute('content', content);
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

/** The description the page's own route sets in its `data`, or null so the site-wide one applies. */
function routeDescription(snapshot: RouterStateSnapshot): string | null {
  let found: string | null = null;

  for (let route: ActivatedRouteSnapshot | null = snapshot.root; route; route = route.firstChild) {
    const description: unknown = route.routeConfig?.data?.[ROUTE_DESCRIPTION_KEY];

    if (typeof description === 'string' && description.length > 0) {
      found = description;
    }
  }

  return found;
}

/** The page's own address on the production origin, without its query string or fragment. */
export function canonicalUrl(routerUrl: string): string {
  const path = routerUrl.split(/[?#]/)[0];
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
