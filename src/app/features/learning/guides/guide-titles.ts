import { ResolveFn } from '@angular/router';

import { SITE_NAME } from '../../../core/seo/site-meta';
import type { HeroGuide } from './hero-guides/hero-guide-data';
import type { StrategistGuide } from './strategist-guides/strategist-guides.data';

/**
 * The page title of a hero guide: the hero guides say "<Hero> guide", while the fundamentals guides
 * that share the route already name themselves ("Neutral Game Fundamentals"), where a suffix would
 * read "...Beginner Guide guide".
 */
export function heroGuideTitle(guide: Pick<HeroGuide, 'heroName' | 'category'>): string {
  return guide.category === 'hero'
    ? `${guide.heroName} guide | ${SITE_NAME}`
    : `${guide.heroName} | ${SITE_NAME}`;
}

export function strategistGuideTitle(guide: Pick<StrategistGuide, 'title'>): string {
  return `${guide.title} | ${SITE_NAME}`;
}

/**
 * Route titles for the guide detail pages. They load the guide data on demand, as the routes'
 * `knownIdGuard` does, so the data stays out of the main bundle. The guard already keeps an unknown
 * id off these routes; the site name is only the fallback if one gets through.
 */
export const heroGuideRouteTitle: ResolveFn<string> = async (route) => {
  const { findHeroGuide } = await import('./hero-guides/hero-guide-data');
  const guide = findHeroGuide(route.paramMap.get('heroId'));

  return guide ? heroGuideTitle(guide) : SITE_NAME;
};

export const strategistGuideRouteTitle: ResolveFn<string> = async (route) => {
  const { findStrategistGuide } = await import('./strategist-guides/strategist-guides.data');
  const guide = findStrategistGuide(route.paramMap.get('guideId'));

  return guide ? strategistGuideTitle(guide) : SITE_NAME;
};
