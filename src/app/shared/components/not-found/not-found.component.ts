import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { respondNotFound } from '../../../core/seo/response-status';
import { reportContentState } from '../../../core/seo/thin-content';
import { PageHeaderComponent } from '../page-header/page-header.component';

/**
 * The page for an address that leads nowhere, including a guide address that names no guide. It
 * answers 404 on the server, shows no ad and asks search engines not to index it (it reports thin
 * content, which the shell and the page-meta strategy act on). It is a routed page and carries
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
    reportContentState(() => 'thin');
  }
}
