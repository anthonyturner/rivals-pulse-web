import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { CommunityFiguresService } from '../../insights/community-figures.service';
import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { buildRoleFiguresView } from './role-figures-view';

/** Damage, healing and damage blocked per minute for each role, or the reason there are none to show yet. */
@Component({
  selector: 'app-community-role-figures',
  imports: [CommunitySummaryComponent],
  templateUrl: './role-figures.component.html',
  styleUrl: './role-figures.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RoleFiguresComponent {
  /** The mode the Stats tab has selected. */
  readonly modeId = input.required<HeroStatsModeId>();

  // undefined while the request runs, null once it has failed.
  private readonly figures = toSignal(inject(CommunityFiguresService).getFigures());

  protected readonly view = computed(() => buildRoleFiguresView(this.figures(), this.modeId()));
}
