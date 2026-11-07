import type { IncomingMessage, ServerResponse } from 'http';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 's-maxage=300, stale-while-revalidate=3600',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

interface JsonRequestOptions {
  allowCors?: boolean;
  cacheControl?: string;
}

export async function handleJsonRequest(
  req: IncomingMessage,
  res: ServerResponse,
  getBody: () => unknown | Promise<unknown>,
  options: JsonRequestOptions = {},
): Promise<void> {
  const extraHeaders = {
    ...(options.allowCors ? corsHeaders : {}),
    ...(options.cacheControl ? { 'cache-control': options.cacheControl } : {}),
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, extraHeaders);
    res.end();
    return;
  }

  if (req.method && req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' }, extraHeaders);
    return;
  }

  try {
    sendJson(res, 200, await getBody(), extraHeaders);
  } catch (error) {
    console.error('Vercel API request failed', error);
    sendJson(res, 500, { error: getErrorMessage(error) }, extraHeaders);
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
