// Writes `sitemap.xml` into the built site, from the route and content data.
//
//   node scripts/write-sitemap.ts [output-folder]
//
// The folder defaults to the browser build, so it runs right after `ng build` (which empties it).
// `robots.txt` is a plain file in `public/`, copied into the build with the other static files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SITE_ORIGIN } from '../src/app/core/seo/site-meta.ts';
import { renderSitemapXml } from '../src/app/core/seo/sitemap.ts';
import { HERO_GUIDES } from '../src/app/features/learning/guides/hero-guides/hero-guide-data.ts';
import { STRATEGIST_GUIDES } from '../src/app/features/learning/guides/strategist-guides/strategist-guides.data.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = join(repoRoot, 'dist', 'rivals-pulse-coach', 'browser');
const SEED_ROSTER = join(repoRoot, 'data', 'seeds', 'heroes.mock.json');

type FetchRoster = (url: string) => Promise<unknown>;

function heroIdsOf(roster: unknown): string[] {
  if (!Array.isArray(roster)) {
    return [];
  }

  return roster.flatMap((hero: unknown) =>
    typeof hero === 'object' && hero !== null && 'id' in hero && typeof hero.id === 'string'
      ? [hero.id]
      : [],
  );
}

/**
 * The roster of record lives in the database, which has heroes the seed file lacks, so the live
 * content API is asked first. The seed file is the fallback so an offline build still gets a
 * sitemap; it is as stale as the last seed, which is why a fallback is logged.
 */
export async function loadHeroIds(fetchRoster: FetchRoster, seedPath = SEED_ROSTER): Promise<string[]> {
  try {
    const ids = heroIdsOf(await fetchRoster(`${SITE_ORIGIN}/api/heroes`));

    if (ids.length > 0) {
      return ids;
    }

    console.warn('The hero roster API returned no heroes; listing the seed roster instead.');
  } catch (error) {
    console.warn('Could not read the hero roster API; listing the seed roster instead.', error);
  }

  return heroIdsOf(JSON.parse(await readFile(seedPath, 'utf8')));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return response.json();
}

/** Writes `sitemap.xml` into `outputFolder` and returns its path. */
export async function writeSitemap(outputFolder: string, fetchRoster: FetchRoster): Promise<string> {
  const xml = renderSitemapXml({
    origin: SITE_ORIGIN,
    heroIds: await loadHeroIds(fetchRoster),
    heroGuideIds: HERO_GUIDES.map((guide) => guide.heroId),
    strategistGuideIds: STRATEGIST_GUIDES.map((guide) => guide.id),
  });
  const file = join(outputFolder, 'sitemap.xml');

  await mkdir(outputFolder, { recursive: true });
  await writeFile(file, xml);

  return file;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = await writeSitemap(resolve(process.argv[2] ?? DEFAULT_OUTPUT), fetchJson);

  console.log(`Wrote ${file}`);
}
