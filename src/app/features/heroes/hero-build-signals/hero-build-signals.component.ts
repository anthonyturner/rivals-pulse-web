import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { CommunityHeroScores } from '../../../../contracts/hero-scores.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { BuildSignalRowsComponent } from './build-signal-rows/build-signal-rows.component';
import { heroAbilityUseRows, heroBuildSignals, scoresSourceNote } from './hero-build-signals';

/** The hero page's build signals: each score, the raw figures behind it, and per-ability use. */
@Component({
  selector: 'app-hero-build-signals',
  imports: [BuildSignalRowsComponent],
  templateUrl: './hero-build-signals.component.html',
  styleUrl: './hero-build-signals.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroBuildSignalsComponent {
  readonly heroId = input.required<string>();
  /** `undefined` while loading, `null` when the scores could not be read. */
  readonly scores = input<CommunityHeroScores | null | undefined>(undefined);

  protected readonly rows = computed(() => heroBuildSignals(this.heroId(), this.scores()));
  protected readonly abilities = computed(() => heroAbilityUseRows(this.heroId(), this.scores()));
  protected readonly sourceNote = computed(() => scoresSourceNote(this.scores()));
  protected readonly isAnswered = computed(() => !!this.scores());

  protected readonly fallbackNotice = computed(() => {
    const scores = this.scores();

    return scores?.inPlaceOf ? halfSeasonFallbackNotice(scores.inPlaceOf.label, scores.halfSeason?.label ?? null) : null;
  });
}
