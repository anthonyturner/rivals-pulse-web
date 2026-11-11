import type { IncomingHttpHeaders } from 'node:http';

/**
 * The forwarding headers the hosting platform (Vercel) sets itself on every request, replacing
 * anything a visitor sent. The server render reads the public host and scheme from them, and an
 * address header such as `x-forwarded-for` is harmless to the render.
 *
 * Angular serves the empty browser shell instead of a server render for any `x-forwarded-*`
 * header it was not told to trust, so leaving `x-forwarded-for` off this list turns every
 * request behind the platform into a blank page.
 */
export const TRUSTED_PROXY_HEADERS = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto'];

/**
 * Removes the `x-forwarded-*` headers that are not trusted, so the render never sees them.
 * The platform does not set the rest (port, prefix), so a request carrying one is a visitor
 * poking at the server, and answering it with the shell would let that visitor put the shell
 * into the CDN cache under a real page's address.
 */
export function dropUntrustedProxyHeaders(headers: IncomingHttpHeaders): void {
  for (const name of Object.keys(headers)) {
    if (name.startsWith('x-forwarded-') && !TRUSTED_PROXY_HEADERS.includes(name)) {
      delete headers[name];
    }
  }
}
