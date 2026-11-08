import { inject, type Signal } from '@angular/core';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { previewData } from '../../hub/preview-data';
import { CurrentHeroStatsService } from '../../insights/current-hero-stats.service';

/** The current hero stats, fetched once however many previews ask. */
export function previewHeroStats(): Signal<HeroStats | null> {
  const stats = inject(CurrentHeroStatsService);

  return previewData(() => stats.getHeroStats());
}
