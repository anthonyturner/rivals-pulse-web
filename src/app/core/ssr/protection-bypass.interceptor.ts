import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { PlatformLocation } from '@angular/common';

/** The header Vercel reads to let an automated request through a protected deployment. */
export const PROTECTION_BYPASS_HEADER = 'x-vercel-protection-bypass';

/**
 * The secret that lets the server render call its own deployment. It is provided only by the
 * server config, so the browser bundle never holds it, and it is `undefined` where there is no
 * secret to send (the browser, local dev, production).
 */
export const PROTECTION_BYPASS_SECRET = new InjectionToken<string | undefined>('PROTECTION_BYPASS_SECRET', {
  providedIn: 'root',
  factory: () => undefined,
});

/**
 * Lets a server render read its own `/api` routes on a preview deployment behind Vercel
 * Authentication, which answers any request without the bypass secret with a login page. The
 * header goes only to the page's own origin, never to another host, and only when a secret exists.
 */
export const protectionBypassInterceptor: HttpInterceptorFn = (request, next) => {
  const secret = inject(PROTECTION_BYPASS_SECRET);

  if (!secret || !isOwnOrigin(request.url, inject(PlatformLocation))) {
    return next(request);
  }

  return next(request.clone({ setHeaders: { [PROTECTION_BYPASS_HEADER]: secret } }));
};

/**
 * Whether the request goes to the host that is serving the page. The URL may still be relative here
 * (Angular makes it absolute further down the chain), and a relative one is the page's own.
 */
function isOwnOrigin(url: string, page: PlatformLocation): boolean {
  const { protocol, hostname, port } = page;
  const pageOrigin = `${protocol}//${hostname}${port ? `:${port}` : ''}`;

  return URL.canParse(url, pageOrigin) && new URL(url, pageOrigin).origin === pageOrigin;
}
