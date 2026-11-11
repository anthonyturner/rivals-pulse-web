import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { PROTECTION_BYPASS_SECRET } from './core/ssr/protection-bypass.interceptor';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // Set by Vercel when Protection Bypass for Automation is on, so a protected preview can render data pages.
    { provide: PROTECTION_BYPASS_SECRET, useFactory: () => process.env['VERCEL_AUTOMATION_BYPASS_SECRET'] || undefined }
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
