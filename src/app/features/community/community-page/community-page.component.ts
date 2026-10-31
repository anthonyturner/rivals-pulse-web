import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, viewChildren } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { tabTargetIndex } from '../../../shared/utilities/tab-keys';
import { COMMUNITY_TABS, DEFAULT_COMMUNITY_TAB_ID } from '../community-tabs';

@Component({
  selector: 'app-community-page',
  imports: [NgComponentOutlet, RouterLink],
  templateUrl: './community-page.component.html',
  styleUrl: './community-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
