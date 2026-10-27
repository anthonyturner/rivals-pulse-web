const DEFAULT_PROVIDER_ROOT = 'https://marvelrivalsapi.com/api';

/**
 * The exact marvelrivalsapi.com reads the Angular client makes, and nothing
 * else. Every call site in `src/app/services/marvel-rivals-api/` maps to one
 * of these.
 *
 * The list is the point of this file. A proxy that forwarded any path would
 * hand the whole provider API to anyone who found the function's URL, spending
 * our quota on endpoints the app has never called.
 */
const ALLOWED_ROUTES: readonly RegExp[] = [
  /^v1\/heroes\/hero\/[^/]+$/,          // hero portrait lookup
  /^v1\/player\/[^/]+$/,                // player profile
  /^v1\/player\/[^/]+\/update$/,        // ask the provider to re-crawl a player
  /^v1\/player\/[^/]+\/match-history$/, // match history, older shape
  /^v2\/player\/[^/]+\/match-history$/, // match history, current shape
  /^v1\/find-player\/[^/]+$/,           // name to provider UID
  /^v1\/match\/[^/]+$/,                 // single match detail
];

/**
 * Returns the path to forward, or `null` to refuse it.
 *
 * The path is returned byte-for-byte as it arrived. Percent-escapes in a
 * player name are the client's `encodeURIComponent` output, and decoding then
 * re-encoding them is how a name that round-trips today starts 404ing.
 */
export function allowedProviderPath(requestedPath: string): string | null {
  if (!requestedPath || requestedPath.startsWith('/')) return null;

  // An encoded slash would let a caller smuggle a path separator past the
  // patterns below, which match a segment as "anything but a slash". No Marvel
  // Rivals name contains one, so refusing costs nothing.
  if (/%2f/i.test(requestedPath)) return null;

  // `.` and `..` are resolved away by the URL parser, so they are a way to
  // reach a path the patterns never matched.
  if (requestedPath.split('/').some(segment => segment === '.' || segment === '..')) return null;

  return ALLOWED_ROUTES.some(route => route.test(requestedPath)) ? requestedPath : null;
}

/**
 * Resolves the provider root the version segment is appended to.
 *
 * `MARVEL_RIVALS_API_BASE_URL` is shared with `sync-hero-stats` and
 * `sync-match-history`, which both expect it to end in `/v1`. This function
 * carries the version in the path instead, so the trailing version is trimmed
 * rather than a second secret being introduced for the same host.
 */
export function providerRootUrl(configured: string | undefined): string {
  const base = (configured?.trim() || DEFAULT_PROVIDER_ROOT).replace(/\/+$/, '');
  const root = base.replace(/\/v\d+$/, '');
  if (!/^https:\/\//.test(root)) {
    throw new Error('MARVEL_RIVALS_API_BASE_URL must be an https URL');
  }
  return root;
}
