import { ResolveFn } from '@angular/router';

import { SITE_NAME } from '../../core/seo/site-meta';
import { findPulseRecordsPage } from './pulse-records.data';

/** The page title of `/records/:category`. The route's `knownIdGuard` keeps an unknown slug off it; the site name is only the fallback. */
export const pulseRecordsCategoryRouteTitle: ResolveFn<string> = (route) => {
  const page = findPulseRecordsPage(route.paramMap.get('category'));

  return page ? `Pulse Records: ${page.title} | ${SITE_NAME}` : SITE_NAME;
};
