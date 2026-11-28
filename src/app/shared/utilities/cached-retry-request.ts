import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

export interface CachedRetryRequestOptions<Body, Answer> {
  /** Builds the request. It runs once per attempt, never while an answer is kept. */
  readonly request: () => Observable<Body>;
  /** The answer for a body, or null when the body is not one worth keeping. */
  readonly accept: (body: Body) => Answer | null;
  /** Logged with the error when the request fails. */
  readonly failureMessage: string;
}

/**
 * Returns a reader for one API answer. Every caller shares one request and an accepted answer is
 * kept for the life of the reader. A failed request, or a body `accept` turns down, gives null and
 * is not kept, so the next caller tries again.
 */
export function cachedRetryRequest<Body, Answer>({
  request,
  accept,
  failureMessage,
}: CachedRetryRequestOptions<Body, Answer>): () => Observable<Answer | null> {
  return cachedNullableRequest(() =>
    request().pipe(
      map(accept),
      catchError((error: unknown) => {
        console.error(failureMessage, error);

        return of(null);
      }),
    ),
  );
}

/**
 * The same sharing for a request that already answers null when it fails (a service that catches
 * its own errors): every caller shares one request, a non-null answer is kept for the life of the
 * reader, and a null answer is not kept, so the next caller tries again.
 */
export function cachedNullableRequest<Answer>(
  request: () => Observable<Answer | null>,
): () => Observable<Answer | null> {
  let answer$: Observable<Answer | null> | null = null;

  return () => {
    answer$ ??= request().pipe(
      tap((answer) => {
        if (answer === null) {
          answer$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return answer$;
  };
}
