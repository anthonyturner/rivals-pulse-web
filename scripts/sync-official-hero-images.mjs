import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';

import { scrapeOfficialHeroes } from './official-heroes-source.mjs';

// Each official hero page carries a transparent full-body render (about
// 1337x1079). Its markup does not label it consistently, so it is picked by size.
const RENDER = { minWidth: 1250, maxWidth: 1500, minHeight: 1000, maxHeight: 1150 };
const PORTRAIT_SIZE = 320;
// The head and shoulders take up roughly the top 42% of a standing figure.
const HEADSHOT_SHARE = 0.42;
// Heroes the site lists under ids the official roster does not have.
const ALIASES = {
  deadpool: ['deadpool-duelist', 'deadpool-strategist', 'deadpool-vanguard'],
  hulk: ['bruce-banner'],
};

const requestHeaders = {
  accept: 'image/png,image/*,*/*',
  'user-agent': 'rivals-pulse-official-image-sync/2.0',
};

const force = process.argv.includes('--force');
const heroImagesPath = join(process.cwd(), 'public', 'images', 'heroes');

const payload = await scrapeOfficialHeroes();
const written = [];
const skipped = [];
const missingRender = [];

await mkdir(heroImagesPath, { recursive: true });

for (const hero of payload.heroes) {
  const fileNames = [hero.id, ...(ALIASES[hero.id] ?? [])].map((id) => `${id}.png`);
  const pending = fileNames.filter((fileName) => force || !existsSync(join(heroImagesPath, fileName)));

  if (pending.length === 0) {
    skipped.push(hero.name);
    continue;
  }

  const renderUrl = await findRenderUrl(hero.articleImageUrls ?? []);

  if (!renderUrl) {
    missingRender.push(hero.name);
    continue;
  }

  const portrait = await headshot(await fetchImage(renderUrl));

  for (const fileName of pending) {
    await writeFile(join(heroImagesPath, fileName), portrait);
    written.push({ hero: hero.name, fileName, bytes: portrait.length });
  }
}

console.log('Official hero image sync complete.');
console.log(`Written: ${written.length}`);
console.log(`Skipped existing: ${skipped.length}`);

for (const item of written) {
  console.log(`- ${item.hero}: ${item.fileName} (${Math.round(item.bytes / 1024)} KB)`);
}

if (missingRender.length > 0) {
  console.log(`No full-body render found: ${missingRender.join(', ')}`);
  process.exitCode = 1;
}

async function findRenderUrl(urls) {
  for (const url of urls.filter((candidate) => /\.png(?:$|\?)/i.test(candidate))) {
    const size = await pngSize(url);

    if (
      size &&
      size.width >= RENDER.minWidth &&
      size.width <= RENDER.maxWidth &&
      size.height >= RENDER.minHeight &&
      size.height <= RENDER.maxHeight
    ) {
      return url;
    }
  }

  return null;
}

/** Reads a transparent PNG's dimensions from its header, without downloading the image. */
async function pngSize(url) {
  const response = await fetch(url, { headers: { ...requestHeaders, range: 'bytes=0-25' } });

  if (!response.ok) {
    return null;
  }

  const header = Buffer.from(await response.arrayBuffer());
  const truecolourWithAlpha = 6;

  return header.length >= 26 &&
    header.toString('latin1', 1, 4) === 'PNG' &&
    header[25] === truecolourWithAlpha
    ? { width: header.readUInt32BE(16), height: header.readUInt32BE(20) }
    : null;
}

/** Crops a square head-and-shoulders portrait from a transparent full-body render. */
async function headshot(render) {
  const { data, info } = await sharp(render)
    .ensureAlpha()
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const figure = opaqueBounds(data, info.width, 0, info.height);
  const figureHeight = figure.bottom - figure.top;
  const side = Math.min(Math.round(figureHeight * HEADSHOT_SHARE), info.width, info.height);

  if (side < PORTRAIT_SIZE / 2) {
    throw new Error(`Render figure is too small to crop a portrait (${side}px).`);
  }
  // The head is centred on whatever is opaque near the top of the figure.
  const head = opaqueBounds(data, info.width, figure.top, figure.top + Math.round(figureHeight * 0.14));
  const centreX = Math.round((head.left + head.right) / 2);
  const left = clamp(centreX - Math.round(side / 2), 0, info.width - side);
  const top = clamp(figure.top - Math.round(side * 0.06), 0, info.height - side);

  return sharp(render)
    .extract({ left, top, width: side, height: side })
    .resize(PORTRAIT_SIZE, PORTRAIT_SIZE, { kernel: 'lanczos3' })
    .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
    .toBuffer();
}

function opaqueBounds(alpha, width, fromRow, toRow) {
  let left = width;
  let right = 0;
  let top = -1;
  let bottom = fromRow;

  for (let y = fromRow; y < toRow; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] > 40) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = top < 0 ? y : top;
        bottom = y;
      }
    }
  }

  if (top < 0) {
    throw new Error('Render has no opaque pixels.');
  }

  return { left, right, top, bottom };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function fetchImage(url) {
  const response = await fetch(url, { headers: requestHeaders });

  if (!response.ok) {
    throw new Error(`Image fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
