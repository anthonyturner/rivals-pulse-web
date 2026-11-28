import { inject, type Signal } from '@angular/core';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { previewData } from '../../hub/preview-data';
import { CurrentHeroMatchupsService } from '../../insights/current-hero-matchups.service';

/** The hero matchups, fetched once however many previews ask; null when they could not be read. */
export function previewMatchups(): Signal<HeroMatchups | null> {
  const matchups = inject(CurrentHeroMatchupsService);

  return previewData(() => matchups.getHeroMatchups());
}
