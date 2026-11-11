import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { LEGACY_REDIRECTS, LEGACY_REDIRECT_PREFIXES } from '../src/app/core/navigation/legacy-redirects.ts';

interface VercelRedirect {
  source: string;
  destination: string;
  permanent?: boolean;
}

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  redirects: VercelRedirect[];
};

const redirectFor = (source: string): VercelRedirect | undefined =>
  config.redirects.find((redirect) => redirect.source === source);

/**
 * Crawlers and bookmarks need a permanent redirect before the app answers, which only `vercel.json`
 * can give; the router redirects behind it serve the dev server and in-app links. The two lists are
 * kept to the one table in `legacy-redirects.ts`.
 */
describe('the permanent redirects in vercel.json', () => {
  for (const { from, to } of LEGACY_REDIRECTS) {
    for (const source of [from, `${from}/`]) {
      it(`send ${source} to ${to} for good`, () => {
        const redirect = redirectFor(source);

        assert.ok(redirect, `${source} has no redirect`);
        assert.equal(redirect.destination, to);
        assert.equal(redirect.permanent, true);
      });
    }
  }

  for (const { from, to } of LEGACY_REDIRECT_PREFIXES) {
    it(`send every other address under ${from} to ${to} for good`, () => {
      const redirect = redirectFor(`${from}/:path*`);

      assert.ok(redirect, `${from}/:path* has no redirect`);
      assert.equal(redirect.destination, to);
      assert.equal(redirect.permanent, true);
    });
  }

  it('put a prefix after the exact addresses under it, because the first match wins', () => {
    for (const { from } of LEGACY_REDIRECT_PREFIXES) {
      const prefixAt = config.redirects.findIndex((redirect) => redirect.source === `${from}/:path*`);
      const exactAt = config.redirects.flatMap((redirect, index) =>
        redirect.source.startsWith(`${from}/`) && !redirect.source.includes(':') ? [index] : [],
      );

      assert.ok(Math.max(...exactAt) < prefixAt, `${from}/:path* comes before an exact address`);
    }
  });

  it('are all permanent, and none leads to an address that is itself redirected', () => {
    const sources = new Set(config.redirects.map((redirect) => redirect.source));

    for (const redirect of config.redirects) {
      assert.equal(redirect.permanent, true, redirect.source);
      assert.ok(!sources.has(redirect.destination.split('?')[0] ?? ''), `${redirect.source} leads to a redirect`);
    }
  });
});
