import { CanMatchFn } from '@angular/router';

/**
 * Matches a route only when the segment its `:param` stands for is in the list the loader returns, so
 * an unknown id falls through to the not-found route and gets its 404 status, `noindex` and title
 * instead of an empty page. The loader imports the data on demand, which keeps it out of the main
 * bundle; the page loads the same chunk next.
 */
export function knownIdGuard(loadIds: () => Promise<readonly string[]>): CanMatchFn {
  return async (route, segments) => {
    const idIndex = (route.path ?? '').split('/').length - 1;
    const id = segments[idIndex]?.path;

    return id !== undefined && (await loadIds()).includes(id);
  };
}
