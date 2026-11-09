// Renders the browser icons from the site logo: public/favicon.ico (16 and 32 px) and
// public/apple-touch-icon.png (180 px). Both use the dark logo, since neither format can follow the
// theme; public/favicon.svg carries the light switch for browsers that read SVG icons.
// Run `npm run icons` after changing public/images/site/rivals-pulse-logo.svg.
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const PUBLIC = new URL('../public/', import.meta.url);
const LOGO = readFileSync(new URL('images/site/rivals-pulse-logo.svg', PUBLIC));

/** The logo as a square PNG of the given size. */
function png(size) {
  return sharp(LOGO, { density: 384 }).resize(size, size).png().toBuffer();
}

/** An ICO file wrapping PNG images, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0);
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

const sizes = [16, 32];
const images = await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })));
writeFileSync(new URL('favicon.ico', PUBLIC), ico(images));
writeFileSync(new URL('apple-touch-icon.png', PUBLIC), await png(180));
console.log('Wrote public/favicon.ico (16, 32 px) and public/apple-touch-icon.png (180 px).');
