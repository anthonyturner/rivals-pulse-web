import { NgComponentOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { tabTargetIndex } from '../../../shared/utilities/tab-keys';
import { HubBentoComponent } from '../../hub/hub-bento/hub-bento.component';
import { COMMUNITY_TABS, DEFAULT_COMMUNITY_TAB_ID } from '../community-tabs';
import { COMMUNITY_LINKS, COMMUNITY_TILES } from '../community-tiles.data';

@Component({
  selector: 'app-community-page',
  imports: [HubBentoComponent, NgComponentOutlet, PageHeaderComponent, RouterLink],
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPageComponent {
  protected readonly links = COMMUNITY_LINKS;
  protected readonly tiles = COMMUNITY_TILES;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly tabList = viewChild.required<ElementRef<HTMLElement>>('tabList');
  private readonly tabElements = viewChildren<ElementRef<HTMLElement>>('tabLink');
  private readonly selectedId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('tab') ?? DEFAULT_COMMUNITY_TAB_ID)),
    { initialValue: DEFAULT_COMMUNITY_TAB_ID },
  );

  protected readonly tabs = computed(() =>
    COMMUNITY_TABS.map((tab) => ({
      ...tab,
      selected: tab.id === this.selectedId(),
      tabId: `community-tab-${tab.id}`,
    })),
  );
  protected readonly selectedTab = computed(
    () => this.tabs().find((tab) => tab.selected) ?? this.tabs()[0],
  );

  constructor() {
    // The bar scrolls sideways on a narrow screen, so a tab reached from a link or the keyboard may start off screen.
    afterRenderEffect(() => {
      const index = this.tabs().findIndex((tab) => tab.selected);
      const selected = this.tabElements()[Math.max(index, 0)]?.nativeElement;
      const list = this.tabList().nativeElement;

      if (selected === undefined) {
        return;
      }

      const bar = list.getBoundingClientRect();
      const tab = selected.getBoundingClientRect();

      if (tab.left < bar.left || tab.right > bar.right) {
        list.scrollTo({ left: list.scrollLeft + tab.left - bar.left - (bar.width - tab.width) / 2 });
      }
    });
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const target = tabTargetIndex(event.key, index, COMMUNITY_TABS.length);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.tabElements()[target].nativeElement.focus();
    void this.router.navigate(['..', COMMUNITY_TABS[target].id], { relativeTo: this.route });
  }
}
