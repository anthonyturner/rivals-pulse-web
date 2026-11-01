import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../../shared/utilities/play-modes';
import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';
import { RoleFiguresComponent } from './role-figures.component';
import { buildRoleStatsView } from './role-stats-view';
import { RoleStatsService } from './role-stats.service';

/** Community benchmarks per role, from Rivals Pulse uploads, or the reason there are none to show yet. */
@Component({
  selector: 'app-community-stats-tab',
  imports: [CommunityEmptyStateComponent, RoleFiguresComponent],
  templateUrl: './stats-tab.component.html',
  styleUrl: './stats-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsTabComponent {
  // undefined while the request runs, null once it has failed.
  private readonly stats = toSignal(inject(RoleStatsService).getRoleStats());
  protected readonly selectedMode = signal<HeroStatsModeId>(DEFAULT_MODE_ID);

  protected readonly view = computed(() => buildRoleStatsView(this.stats(), this.selectedMode()));

  protected selectMode(id: HeroStatsModeId): void {
    this.selectedMode.set(id);
  }
}
