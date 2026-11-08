import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject, signal, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, type Observable } from 'rxjs';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { Hero } from '../../heroes/hero.model';
import { HeroDataService } from '../../heroes/hero-data.service';
import { HomeHeroStatsService } from '../../home/home-hero-stats.service';

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

/** The current hero stats, fetched once however many previews ask. */
export function previewHeroStats(): Signal<HeroStats | null> {
  const stats = inject(HomeHeroStatsService);

  return previewData(() => stats.getHeroStats());
}

/** The roster, or null when it is empty or could not be loaded. */
export function previewRoster(): Signal<readonly Hero[] | null> {
  const heroes = inject(HeroDataService);

  return previewData(() => heroes.getHeroes().pipe(map((roster) => (roster.length > 0 ? roster : null))));
}
