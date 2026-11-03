import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';

import { scrapeOfficialHeroes } from './official-heroes-source.mjs';

const force = process.argv.includes('--force');
const heroImagesPath = join(process.cwd(), 'public', 'images', 'heroes');

const payload = await scrapeOfficialHeroes();
const downloaded = [];
const skipped = [];
const missingSource = [];

for (const hero of payload.heroes) {
  const sourceUrl = hero.listImageUrl;

  if (!sourceUrl) {
    missingSource.push(hero.name);
    continue;
  }

  const extension = imageExtension(sourceUrl);
  const fileName = `${hero.id}${extension}`;
  const target = join(heroImagesPath, fileName);

  if (!force && existsSync(target)) {
    skipped.push(hero.name);
    continue;
  }

  const bytes = await fetchImage(sourceUrl);

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  downloaded.push({ hero: hero.name, fileName });
}

console.log(`Official hero image sync complete.`);
console.log(`Downloaded: ${downloaded.length}`);
console.log(`Skipped existing: ${skipped.length}`);

if (missingSource.length > 0) {
  console.log(`Missing source image: ${missingSource.join(', ')}`);
}

if (downloaded.length > 0) {
  for (const item of downloaded) {
    console.log(`- ${item.hero}: ${item.fileName}`);
  }
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'image/avif,image/webp,image/png,image/jpeg,*/*',
      'user-agent': 'rivals-pulse-official-image-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Image fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function imageExtension(url) {
  const cleanPath = new URL(url).pathname;
  const extension = extname(cleanPath).toLowerCase();

  return ['.png', '.jpg', '.jpeg', '.webp', '.avif'].includes(extension) ? extension : '.png';
}
