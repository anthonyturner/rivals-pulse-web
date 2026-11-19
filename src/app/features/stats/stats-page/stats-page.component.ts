import { afterRenderEffect, ChangeDetectionStrategy, Component, computed, inject, viewChild, viewChildren } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DEFAULT_STATS_TAB, STATS_TAB_DATA_KEY, STATS_TABS, statsTabLink } from '../stats-tabs';

/**
 * The Stats hub: the heading of the open tab, a bar of links to every tab, and the tab itself below.
 * The bar is plain links, not a script-driven tab list, so each tab is a page a crawler can follow and
 * the one on screen is marked with `aria-current`.
 */
@Component({
  selector: 'app-stats-page',
  imports: [PageHeaderComponent, RouterLink, RouterOutlet],
  templateUrl: './stats-page.component.html',
  styleUrl: './stats-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');
  private readonly barLinks = viewChildren<ElementRef<HTMLElement>>('barLink');
  private readonly openId = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.route.snapshot.firstChild?.data[STATS_TAB_DATA_KEY] as string | undefined),
    ),
    { initialValue: undefined },
  );

  protected readonly open = computed(() => STATS_TABS.find((tab) => tab.id === this.openId()) ?? DEFAULT_STATS_TAB);
  protected readonly tabs = computed(() =>
    STATS_TABS.map((tab) => ({ id: tab.id, label: tab.label, link: statsTabLink(tab), current: tab === this.open() })),
  );

  constructor() {
    // The bar scrolls sideways on a narrow screen, so the open tab may start off screen.
    afterRenderEffect(() => {
      const index = this.tabs().findIndex((tab) => tab.current);
      const current = this.barLinks()[Math.max(index, 0)]?.nativeElement;
      const bar = this.bar().nativeElement;

      if (current === undefined) {
        return;
      }

      const barBox = bar.getBoundingClientRect();
      const linkBox = current.getBoundingClientRect();

      if (linkBox.left < barBox.left || linkBox.right > barBox.right) {
        bar.scrollTo({ left: bar.scrollLeft + linkBox.left - barBox.left - (barBox.width - linkBox.width) / 2 });
      }
    });
  }
}
