import { inject } from '@angular/core';
import { CanMatchFn, ResolveFn, Router, Routes, UrlMatcher } from '@angular/router';
import { map } from 'rxjs';

import { SITE_NAME } from '../../core/seo/site-meta';
import { HeroDataService } from './hero-data.service';

const HEROES_TITLE = `Heroes | ${SITE_NAME}`;

/**
 * Matches `/heroes` and `/heroes/:heroId` as one route. Two route entries would be two route
 * configs, and the router rebuilds the page between them; one keeps the same page, with its roster
 * filters and scroll position, when a hero is chosen or closed.
 */
export const heroesMatcher: UrlMatcher = (segments) => {
  if (segments[0]?.path !== 'heroes' || segments.length > 2) {
    return null;
  }

  return segments.length === 2
    ? { consumed: segments, posParams: { heroId: segments[1] } }
    : { consumed: segments };
};

/** Sends an old `/heroes?hero=storm` link to `/heroes/storm`, keeping the rest of the query. */
const legacyHeroLinkGuard: CanMatchFn = (_route, segments) => {
  const router = inject(Router);
  const query = router.currentNavigation()?.extractedUrl.queryParams ?? {};
  const heroId: unknown = Array.isArray(query['hero']) ? query['hero'][0] : query['hero'];

  if (segments.length > 1 || typeof heroId !== 'string' || heroId === '') {
    return true;
  }

  const rest = Object.fromEntries(Object.entries(query).filter(([key]) => key !== 'hero'));

  return router.createUrlTree(['/heroes', heroId], { queryParams: rest });
};

/**
 * Lets an address with a hero in it match only when the roster has that hero, so any other address
 * falls through to the not-found page. A roster that could not be loaded cannot say, so the route
 * matches and the page shows its error instead of a not-found page for a hero that may exist.
 */
const knownHeroGuard: CanMatchFn = (_route, segments) => {
  const heroId = segments[1]?.path;

  if (heroId === undefined) {
    return true;
  }

  return inject(HeroDataService)
    .getHeroRoster()
    .pipe(map((roster) => roster === null || roster.some((hero) => hero.id === heroId)));
};

const heroesTitle: ResolveFn<string> = (route) => {
  const heroId = route.paramMap.get('heroId');

  if (heroId === null) {
    return HEROES_TITLE;
  }

  return inject(HeroDataService)
    .getHeroRoster()
    .pipe(
      map((roster) => {
        const hero = roster?.find((candidate) => candidate.id === heroId);

        return hero ? `${hero.name} | ${SITE_NAME}` : HEROES_TITLE;
      }),
    );
};

export const heroesRoutes: Routes = [
  {
    matcher: heroesMatcher,
    canMatch: [legacyHeroLinkGuard, knownHeroGuard],
    title: heroesTitle,
    loadComponent: () =>
      import('./heroes-page.component').then((module) => module.HeroesPageComponent),
  },
];
