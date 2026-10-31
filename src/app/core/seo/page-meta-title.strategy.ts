import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

import {
  PREVIEW_IMAGE_ALT,
  PREVIEW_IMAGE_HEIGHT,
  PREVIEW_IMAGE_PATH,
  PREVIEW_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
} from './site-meta';

/**
 * Keeps the page title and the link-preview tags in step with the route, on the
 * server and in the browser. A route's `title` becomes the page title and the
 * preview title; a route without one falls back to the site name. The
 * canonical URL is the production origin plus the route's own path, so no page
 * claims another page as its canonical.
 */
@Injectable({ providedIn: 'root' })
export class PageMetaTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

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
    this.setCanonical(url);
  }

  private setTags(tags: { name?: string; property?: string; content: string }[]): void {
    for (const tag of tags) {
      this.meta.updateTag(tag);
    }
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}

/** The page's own address on the production origin, without its query string or fragment. */
export function canonicalUrl(routerUrl: string): string {
  const path = routerUrl.split(/[?#]/)[0];
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
