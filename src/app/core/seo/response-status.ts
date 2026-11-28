import { inject, RESPONSE_INIT } from '@angular/core';

/**
 * Makes the server answer the page it is rendering with 404. Call it from an injection context that
 * is created only for a missing page. The server reads the status after the render settles, so a
 * page can decide late; in the browser there is no response to change and this does nothing.
 */
export function respondNotFound(): void {
  const response = inject(RESPONSE_INIT, { optional: true });

  if (response) {
    response.status = 404;
  }
}
