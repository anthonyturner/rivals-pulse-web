import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { BuildSignalRow, BuildSignalSource } from '../hero-build-signals';

const SOURCE_CLASSES: Record<BuildSignalSource, string> = {
  Measured: 'measured',
  Estimated: 'estimated',
  'Hero kit': 'hero-kit',
};

/** The five build signals, each labelled with where its number comes from, for one hero or one team. */
@Component({
  selector: 'app-build-signal-rows',
  templateUrl: './build-signal-rows.component.html',
  styleUrl: './build-signal-rows.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildSignalRowsComponent {
  readonly rows = input.required<readonly BuildSignalRow[]>();

  protected readonly viewRows = computed(() =>
    this.rows().map((row) => ({
      ...row,
      sourceClass: SOURCE_CLASSES[row.source],
      percent: (row.value ?? 0) * 10,
      roundedValue: Math.round((row.value ?? 0) * 10) / 10,
    })),
  );
}
