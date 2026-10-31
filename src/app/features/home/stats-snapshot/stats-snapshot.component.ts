import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';

import { tabTargetIndex } from '../../../shared/utilities/tab-keys';
import { HeroDataService } from '../../heroes/hero-data.service';
import { heroIdentities } from '../../insights/hero-identity';
import { HomeHeroStatsService } from '../home-hero-stats.service';
import {
  buildStatsSnapshotView,
  SNAPSHOT_SLOTS,
  SNAPSHOT_TABS,
  type SnapshotTabId,
  type StatsSnapshotView,
} from './stats-snapshot-view';

/**
 * The home page's hero numbers: the most-picked heroes from Rivals Pulse overlay matches, by role.
 * The server renders the heading and the reserved loading panel; the browser fetches the numbers.
 */
@Component({
  selector: 'app-stats-snapshot',
  imports: [RouterLink],
  templateUrl: './stats-snapshot.component.html',
  styleUrl: './stats-snapshot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsSnapshotComponent {
  private readonly homeStats = inject(HomeHeroStatsService);
  private readonly tabElements = viewChildren<ElementRef<HTMLElement>>('tab');

  /** `null` while the numbers load. */
  protected readonly view = signal<StatsSnapshotView | null>(null);
  private readonly selectedId = signal<SnapshotTabId>('all');

  protected readonly panelId = 'stats-snapshot-panel';
  protected readonly invitation = 'Every match played with Rivals Pulse makes these stats sharper.';
  protected readonly skeletonRows = Array.from({ length: SNAPSHOT_SLOTS }, (_, index) => index);

  protected readonly heading = computed(() => {
    const view = this.view();
    const label = view?.kind === 'ready' ? view.halfSeasonLabel : null;

    return label === null ? 'Hero stats' : `Hero stats · ${label}`;
  });
  protected readonly tabs = computed(() =>
    SNAPSHOT_TABS.map((tab) => ({
      id: tab.id,
      label: tab.label,
      selected: tab.id === this.selectedId(),
      tabId: `stats-snapshot-tab-${tab.id}`,
    })),
  );
  protected readonly selectedTab = computed(() => this.tabs().find((tab) => tab.selected) ?? this.tabs()[0]);
  protected readonly panel = computed(() => {
    const view = this.view();

    return view?.kind === 'ready' ? (view.panels.find((panel) => panel.id === this.selectedId()) ?? null) : null;
  });

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      combineLatest({ stats: this.homeStats.getHeroStats(), heroes: inject(HeroDataService).getHeroes() })
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe(({ stats, heroes }) => this.view.set(buildStatsSnapshotView(stats, heroIdentities(heroes))));
    }
  }

  protected select(id: SnapshotTabId): void {
    this.selectedId.set(id);
  }

  protected retry(): void {
    this.view.set(null);
    this.homeStats.reload();
  }

  protected onTabKeydown(event: KeyboardEvent, index: number): void {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const target = tabTargetIndex(event.key, index, SNAPSHOT_TABS.length);

    if (target === null) {
      return;
    }

    event.preventDefault();
    this.select(SNAPSHOT_TABS[target].id);
    this.tabElements()[target].nativeElement.focus();
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
