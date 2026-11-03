import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * The page for an address that leads nowhere, and the view a page shows in place of its content when
 * the thing it was asked for does not exist. It asks search engines not to index the page it is on.
 */
@Component({
  selector: 'app-not-found',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './not-found.component.html',
  styleUrls: ['../../../features/learning/guides/guide-article/guide-article.css', './not-found.component.css'],
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
    const meta = inject(Meta);
    const tag = meta.addTag({ name: 'robots', content: 'noindex' });

    inject(DestroyRef).onDestroy(() => tag && meta.removeTagElement(tag));
  }
}
