import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { LEGACY_REDIRECTS } from '../src/app/core/navigation/legacy-redirects.ts';
import { SITE_ORIGIN } from '../src/app/core/seo/site-meta.ts';
import { loadHeroIds, writeSitemap } from './write-sitemap.ts';

const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
const vercel: { headers: { source: string; headers: { key: string; value: string }[] }[] } =
  JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

const roster = [{ id: 'storm' }, { id: 'new-hero' }];

function contentTypeFor(source: string): string | undefined {
  return vercel.headers
    .find((rule) => rule.source === source)
    ?.headers.find((header) => header.key === 'Content-Type')?.value;
}

async function builtSitemap(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'sitemap-'));

  try {
    return await readFile(await writeSitemap(folder, async () => roster), 'utf8');
  } finally {
    await rm(folder, { recursive: true });
  }
}

describe('robots.txt', () => {
  it('allows crawling, keeps private pages out and names the sitemap', () => {
    const lines = robots.split(/\r?\n/);

    assert.ok(lines.includes('User-agent: *'));
    assert.ok(lines.includes('Allow: /'));
    for (const path of ['/admin', '/account', '/profile', '/sign-in']) {
      assert.ok(lines.includes(`Disallow: ${path}`), path);
    }
    assert.ok(lines.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`));
  });
});

describe('content types in vercel.json', () => {
  it('serves robots.txt as plain text and sitemap.xml as XML', () => {
    assert.match(contentTypeFor('/robots.txt') ?? '', /^text\/plain/);
    assert.match(contentTypeFor('/sitemap.xml') ?? '', /^application\/xml/);
  });
});

describe('sitemap.xml', () => {
  it('is written with production URLs, including a hero the seed file lacks', async () => {
    const xml = await builtSitemap();
    const locations = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? '');

    assert.ok(locations.length > 0);
    assert.ok(locations.every((location) => location.startsWith(`${SITE_ORIGIN}/`)));
    assert.ok(locations.includes(`${SITE_ORIGIN}/heroes/new-hero`));
    assert.ok(locations.includes(`${SITE_ORIGIN}/hero-guides/captain-america`));
    assert.ok(locations.includes(`${SITE_ORIGIN}/faq`));
  });

  it('lists no account, admin, data or unreleased page', async () => {
    const xml = await builtSitemap();
    const hidden = [
      'admin',
      'account',
      'profile',
      'sign-in',
      'learning-paths',
      'watch-next',
      'tier-list',
      'win-rates',
      'game-stats',
      'team-comps',
      'records',
      'community',
    ];

    for (const path of hidden) {
      assert.ok(!xml.includes(`${SITE_ORIGIN}/${path}`), path);
    }
  });

  it('lists no address that redirects to the Stats hub, and does list the hub', async () => {
    const xml = await builtSitemap();
    const locations = new Set([...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1] ?? ''));

    for (const { from } of LEGACY_REDIRECTS) {
      assert.ok(!locations.has(`${SITE_ORIGIN}${from}`), from);
    }
    assert.ok(locations.has(`${SITE_ORIGIN}/stats`));
  });
});

describe('the hero roster', () => {
  it('comes from the content API', async () => {
    assert.deepEqual(await loadHeroIds(async () => roster), ['storm', 'new-hero']);
  });

  it('falls back to the seed roster when the API fails or is empty', async () => {
    const quiet = console.warn;

    console.warn = () => undefined;
    try {
      const failed = await loadHeroIds(async () => {
        throw new Error('offline');
      });
      const empty = await loadHeroIds(async () => []);

      assert.ok(failed.includes('storm'));
      assert.deepEqual(empty, failed);
    } finally {
      console.warn = quiet;
    }
  });
});
