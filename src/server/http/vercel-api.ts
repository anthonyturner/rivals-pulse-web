import type { IncomingMessage, ServerResponse } from 'http';

/** What a shared cache (the CDN) may keep of an answer when a route says nothing more specific. */
export const DEFAULT_CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=3600';

/** For an answer no cache may keep: every error, and any answer that is only a stand-in. */
export const NO_STORE_CACHE_CONTROL = 'no-store';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': DEFAULT_CACHE_CONTROL,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface JsonRequestOptions {
  allowCors?: boolean;
  /** The `Cache-Control` of a successful answer; errors are never cached. */
  cacheControl?: string;
}

export async function handleJsonRequest<T = unknown>(
  req: IncomingMessage,
  res: ServerResponse,
  getBody: () => T | Promise<T>,
  options: JsonRequestOptions = {},
): Promise<void> {
  const corsOnly = options.allowCors ? corsHeaders : {};
  const uncached = { ...corsOnly, 'cache-control': NO_STORE_CACHE_CONTROL };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsOnly);
    res.end();
    return;
  }

  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, uncached);
    return;
  }

  try {
    const body = await getBody();

    sendJson(res, 200, body, { ...corsOnly, ...(options.cacheControl ? { 'cache-control': options.cacheControl } : {}) });
  } catch (error) {
    console.error('Vercel API request failed', error);
    sendJson(res, 500, { error: getErrorMessage(error) }, uncached);
  }
}

export function sendJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  extraHeaders?: Record<string, string>,
): void {
  res.writeHead(statusCode, { ...jsonHeaders, ...extraHeaders });
  res.end(JSON.stringify(body));
}

export function getQueryStringValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load content data';
}
