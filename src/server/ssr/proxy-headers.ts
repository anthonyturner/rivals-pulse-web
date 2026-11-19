import type { IncomingHttpHeaders } from 'node:http';

/**
 * The forwarding headers the render may see: the visitor's address, which it ignores, and the
 * scheme. The host is not among them. The render reads its own host from the `Host` header and
 * sends its `/api` calls there, so a forged `x-forwarded-host` could make it draw another site's
 * data, and the CDN would keep that page under our address.
 *
 * Angular serves the empty browser shell instead of a server render for any `x-forwarded-*`
 * header it was not told to trust, so leaving `x-forwarded-for` off this list turns every
 * request behind the platform into a blank page.
 */
export const TRUSTED_PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-proto'];

/**
 * Removes the `x-forwarded-*` headers that are not trusted, so the render never sees them: it then
 * neither trusts them nor falls back to the shell because of them. A visitor can send any of these
 * (host, port, prefix), and answering one with the shell would let that visitor put the shell into
 * the CDN cache under a real page's address.
 */
export function dropUntrustedProxyHeaders(headers: IncomingHttpHeaders): void {
  for (const name of Object.keys(headers)) {
    if (name.startsWith('x-forwarded-') && !TRUSTED_PROXY_HEADERS.includes(name)) {
      delete headers[name];
    }
  }
}
