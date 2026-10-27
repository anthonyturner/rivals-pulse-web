import { allowedProviderPath, providerRootUrl } from './routes.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FUNCTION_NAME = 'marvel-rivals-proxy';
const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Forwards a small, fixed set of marvelrivalsapi.com reads, adding the
 * provider credential server-side.
 *
 * The key used to ship inside the Angular bundle, which an Overwolf install
 * unpacks to disk in plain text, so every user held a copy (issue #381). It
 * lives here instead, in `MARVEL_RIVALS_API_KEY` - the same function secret
 * `sync-hero-stats` and `sync-match-history` already read.
 *
 * This is a pass-through, not a cache: the client already caches provider
 * responses in three layers, and a fourth would change how stale a stat may be
 * without an agreed rule for it.
 */
Deno.serve(async request => {
  // Nothing may escape this handler. An uncaught throw does not reach the
  // caller as an error they can read - Supabase replaces the whole response
  // with a Cloudflare 502 and `sb-error-code: EDGE_FUNCTION_ERROR`, which
  // tells a client nothing and bypasses the CORS headers below.
  try {
    return await handleRequest(request);
  } catch (error) {
    return json({ error: `Marvel Rivals proxy failed: ${getErrorMessage(error)}` }, 500);
  }
});

async function handleRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Every proxied endpoint is a read. Refusing the rest keeps the surface
  // exposed by this function the same size as the surface it replaced.
  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const requestUrl = new URL(request.url);
  const requestedPath = pathAfterFunctionName(requestUrl.pathname);
  const providerPath = requestedPath === null ? null : allowedProviderPath(requestedPath);
  if (!providerPath) {
    // Deliberately terse: an unroutable path gets no hint about what would route.
    return json({ error: 'Unknown endpoint' }, 404);
  }

  let providerRoot: string;
  try {
    providerRoot = providerRootUrl(Deno.env.get('MARVEL_RIVALS_API_BASE_URL'));
  } catch (error) {
    return json({ error: getErrorMessage(error) }, 500);
  }

  const apiKey = Deno.env.get('MARVEL_RIVALS_API_KEY')?.trim();
  if (!apiKey) {
    return json({ error: 'MARVEL_RIVALS_API_KEY is not configured' }, 500);
  }

  const providerUrl = `${providerRoot}/${providerPath}${requestUrl.search}`;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), PROVIDER_TIMEOUT_MS);

  try {
    const providerResponse = await fetch(providerUrl, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: abort.signal,
    });

    // Read the body here rather than handing the upstream stream to the
    // caller. A stream stays attached to the abort signal after the headers
    // arrive, so a slow body aborts mid-flight and Supabase sees a truncated
    // response instead of the provider's answer. These payloads are small
    // enough that buffering costs nothing and makes the response always whole.
    const body = await providerResponse.arrayBuffer();

    // The provider's status and body are returned unchanged so the Angular
    // callers' existing `catchError` fallback chains see what they saw before.
    // That includes provider outages: a 502 from the provider is forwarded as
    // a 502, not turned into one of ours.
    return new Response(body, {
      status: providerResponse.status,
      headers: {
        ...corsHeaders,
        'Content-Type': providerResponse.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (error) {
    // `providerUrl` is safe to omit and the key is never in scope for logging.
    return json({ error: `Marvel Rivals provider request failed: ${getErrorMessage(error)}` }, 502);
  } finally {
    // Leaving the timer armed would fire against an already-finished request.
    clearTimeout(timer);
  }
}

/**
 * Returns the provider path the caller asked for, or `null` when the request
 * did not arrive through this function's route. Supabase serves the function
 * at `/functions/v1/<name>/...` in the cloud and at `/<name>/...` locally, so
 * the name is the only reliable anchor.
 */
function pathAfterFunctionName(pathname: string): string | null {
  const marker = `/${FUNCTION_NAME}/`;
  const index = pathname.indexOf(marker);
  if (index === -1) return null;
  return pathname.slice(index + marker.length);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
