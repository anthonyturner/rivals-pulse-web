import type { IncomingMessage, ServerResponse } from 'http';

import { DEFAULT_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, handleJsonRequest } from './vercel-api.ts';

interface Body {
  stored: boolean;
}

interface Sent {
  status: number;
  headers: Record<string, string>;
  body: string;
}

type Options = Parameters<typeof handleJsonRequest<Body>>[3];

async function answer(method: string, getBody: () => Body, options?: Options): Promise<Sent> {
  const sent: Sent = { status: 0, headers: {}, body: '' };
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      sent.status = status;
      sent.headers = headers;
    },
    end(body?: string) {
      sent.body = body ?? '';
    },
  } as unknown as ServerResponse;

  await handleJsonRequest({ method } as IncomingMessage, res, getBody, options);

  return sent;
}

describe('handleJsonRequest cache headers', () => {
  it('lets the CDN keep a good answer for the default time', async () => {
    const sent = await answer('GET', () => ({ stored: true }));

    expect(sent.status).toBe(200);
    expect(sent.headers['cache-control']).toBe(DEFAULT_CACHE_CONTROL);
  });

  it('sends a fixed cache header as given', async () => {
    const sent = await answer('GET', () => ({ stored: true }), { cacheControl: 'public, s-maxage=60' });

    expect(sent.headers['cache-control']).toBe('public, s-maxage=60');
  });

  it('chooses the cache header from the body', async () => {
    const cacheControl = (body: Body) => (body.stored ? 'public, s-maxage=60' : NO_STORE_CACHE_CONTROL);

    const stored = await answer('GET', () => ({ stored: true }), { cacheControl });
    const unstored = await answer('GET', () => ({ stored: false }), { cacheControl });

    expect(stored.headers['cache-control']).toBe('public, s-maxage=60');
    expect(unstored.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
    expect(JSON.parse(unstored.body)).toEqual({ stored: false });
  });

  it('keeps the CORS headers beside a chosen cache header', async () => {
    const sent = await answer('GET', () => ({ stored: false }), {
      allowCors: true,
      cacheControl: () => NO_STORE_CACHE_CONTROL,
    });

    expect(sent.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(sent.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('never lets the CDN keep a failure, whatever cache header the route sets', async () => {
    spyOn(console, 'error');
    const failing = (): Body => {
      throw new Error('boom');
    };

    const sent = await answer('GET', failing, { cacheControl: 'public, s-maxage=60' });

    expect(sent.status).toBe(500);
    expect(sent.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('never lets the CDN keep a refusal of a method', async () => {
    const sent = await answer('POST', () => ({ stored: true }), { cacheControl: 'public, s-maxage=60' });

    expect(sent.status).toBe(405);
    expect(sent.headers['cache-control']).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('answers a preflight request with the CORS headers and no body', async () => {
    const sent = await answer('OPTIONS', () => ({ stored: true }), { allowCors: true });

    expect(sent.status).toBe(204);
    expect(sent.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(sent.body).toBe('');
  });
});
