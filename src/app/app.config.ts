import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter, TitleStrategy, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideAdSense } from './shared/components/ad-slot/adsense/adsense.provider';
import { provideReturnTrail } from './core/navigation/return-trail';
import { PageMetaTitleStrategy } from './core/seo/page-meta-title.strategy';
import { provideClientHydration, withEventReplay, withHttpTransferCacheOptions } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
    provideReturnTrail(),
    provideHttpClient(withFetch()),
    provideClientHydration(
      withEventReplay(),
      withHttpTransferCacheOptions({
        filter: (req) => !req.url.startsWith('/api/'),
      }),
    ),
    provideAdSense(),
  ]
};
