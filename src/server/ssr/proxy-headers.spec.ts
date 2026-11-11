import { TRUSTED_PROXY_HEADERS, dropUntrustedProxyHeaders } from './proxy-headers.ts';

describe('proxy headers', () => {
  it('trusts the headers Vercel sets on every request, including the visitor address', () => {
    expect(TRUSTED_PROXY_HEADERS).toEqual(['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']);
  });

  it('keeps the trusted forwarding headers and every other header', () => {
    const headers = {
      host: 'rivalspulse.com',
      'x-forwarded-for': '203.0.113.9',
      'x-forwarded-host': 'rivalspulse.com',
      'x-forwarded-proto': 'https',
      'x-vercel-id': 'fra1::abc',
    };

    dropUntrustedProxyHeaders(headers);

    expect(Object.keys(headers)).toEqual([
      'host',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'x-vercel-id',
    ]);
  });

  it('drops forwarding headers the platform does not set', () => {
    const headers: Record<string, string> = {
      host: 'rivalspulse.com',
      'x-forwarded-port': '1',
      'x-forwarded-prefix': '/evil',
    };

    dropUntrustedProxyHeaders(headers);

    expect(headers).toEqual({ host: 'rivalspulse.com' });
  });
});
