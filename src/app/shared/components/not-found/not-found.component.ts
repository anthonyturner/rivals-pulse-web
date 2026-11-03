import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { respondNotFound } from '../../../core/seo/response-status';
import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * The page for an address that leads nowhere, including a guide address that names no guide. It
 * answers 404 on the server and asks search engines not to index it. It is a routed page and carries
 * its own page container, so do not nest it inside another one.
 */
@Component({
  selector: 'app-not-found',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './not-found.component.html',
  styleUrls: ['../../styles/guide-article.css', './not-found.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundComponent {
  readonly links = [
    { label: 'Home', path: '/' },
    { label: 'Heroes', path: '/heroes' },
    { label: 'Guides', path: '/hero-guides' },
    { label: 'Counters', path: '/counters' },
    { label: 'Tools', path: '/tools' },
    { label: 'Resources', path: '/resources' },
  ];

  constructor() {
    respondNotFound();

    const meta = inject(Meta);
    const tag = meta.addTag({ name: 'robots', content: 'noindex' });

    inject(DestroyRef).onDestroy(() => tag && meta.removeTagElement(tag));
  }
}
