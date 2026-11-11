import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { RESPONSE_INIT, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ThinContent } from './thin-content';

/** What a shared cache must not keep: a page drawn while the data behind it was failing. */
export const FAILED_RENDER_CACHE_CONTROL = 'no-store';

/**
 * During a server render, marks the page uncacheable once any of its requests fails. A data page
 * then draws its error state, and a CDN that kept that HTML would show the error to everyone long
 * after the data came back. The same failure makes a page that reports no content state of its own
 * thin, so the error page asks search engines not to index it. The server reads the headers after
 * the render settles; in the browser there is no response to change and this does nothing.
 */
export const uncachedOnFailedRequestInterceptor: HttpInterceptorFn = (request, next) => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const thinContent = inject(ThinContent);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (response?.headers instanceof Headers && error instanceof HttpErrorResponse) {
        response.headers.set('cache-control', FAILED_RENDER_CACHE_CONTROL);
        thinContent.reportFailedRequest();
      }

      return throwError(() => error);
    }),
  );
};
