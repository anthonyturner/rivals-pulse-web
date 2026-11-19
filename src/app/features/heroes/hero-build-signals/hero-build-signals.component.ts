import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

import type { CommunityHeroScores } from '../../../../contracts/hero-scores.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import type { Hero } from '../hero.model';
import { BuildSignalRowsComponent } from './build-signal-rows/build-signal-rows.component';
import type { HeroBuildType } from './hero-build-signals';
import { heroAbilityUseRows, heroBuildSignals, scoresSourceNote } from './hero-build-signals';

@Component({
  selector: 'app-hero-build-signals',
  imports: [BuildSignalRowsComponent],
  templateUrl: './hero-build-signals.component.html',
  styleUrl: './hero-build-signals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBuildSignalsComponent {
  readonly hero = input.required<Hero>();
  /** `undefined` while loading, `null` when the scores could not be read. */
  readonly scores = input<CommunityHeroScores | null | undefined>(undefined);

  protected readonly selectedType = linkedSignal<string, HeroBuildType>({
    source: () => this.hero().id,
    computation: () => 'Damage',
  });
  protected readonly rows = computed(() => heroBuildSignals(this.hero().id, this.scores()));
  protected readonly selectedRows = computed(() => this.rows().filter((row) => row.type === this.selectedType()));
  protected readonly abilities = computed(() => heroAbilityUseRows(this.hero().id, this.scores()));
  protected readonly sourceNote = computed(() => scoresSourceNote(this.scores()));
  protected readonly isAnswered = computed(() => !!this.scores());

  protected readonly fallbackNotice = computed(() => {
    const scores = this.scores();

    return scores?.inPlaceOf ? halfSeasonFallbackNotice(scores.inPlaceOf.label, scores.halfSeason?.label ?? null) : null;
  });
}
