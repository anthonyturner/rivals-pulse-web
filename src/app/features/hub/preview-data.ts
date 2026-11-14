import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, type Observable } from 'rxjs';

import type { HeroSynergies } from '../../../contracts/hero-synergies.model';
import type { Hero } from '../heroes/hero.model';
import { HeroDataService } from '../heroes/hero-data.service';
import { HeroSynergiesService } from '../insights/hero-synergies.service';

/**
 * The answer a tile's preview draws from, or null while it loads, if it fails or on the server.
 * A preview is a nicety, so the server render never waits for one and the tile reads the same
 * without it. Call it from a field initialiser, where the injection context is open.
 */
export function previewData<T>(load: () => Observable<T | null>): Signal<T | null> {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return signal<T | null>(null).asReadonly();
  }

  return toSignal(load().pipe(catchError(() => of(null))), { initialValue: null });
}

/** The roster, or null when it is empty or could not be loaded. */
export function previewRoster(): Signal<readonly Hero[] | null> {
  const heroes = inject(HeroDataService);

  return previewData(() => heroes.getHeroRoster());
}

/**
 * The hero pairs in Competitive, the mode the Team comps page opens on, so a preview of the best
 * duos shows the same duos as that page. Every preview that draws pairs reads them here, so the mode
 * is chosen once.
 */
export function previewSynergies(): Signal<HeroSynergies | null> {
  const synergies = inject(HeroSynergiesService);

  return previewData(() => synergies.getHeroSynergies(undefined, 'competitive'));
}
