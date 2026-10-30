// The home page part of `npm run db:seed`: loads the portal cards and the content blocks in
// data/seeds into Supabase. It overwrites the blocks the seed file names and leaves every other
// block alone; the home news sync rewrites its own blocks on its next run.
import { readFileSync } from 'node:fs';

import { replaceHomePortals, saveHomeContentBlocks } from '../src/home-content-store.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const portals = readSeed('home-portals.mock.json');
const blocks = readSeed('home-content.mock.json');
const client = getSupabaseClient();
const updatedAt = new Date().toISOString();

await replaceHomePortals(client, portals, updatedAt);
await saveHomeContentBlocks(client, blocks, updatedAt);

console.log(`Seeded Supabase home content: ${portals.length} portals, ${Object.keys(blocks).length} content blocks.`);

function readSeed(fileName) {
  return JSON.parse(readFileSync(new URL(`../data/seeds/${fileName}`, import.meta.url), 'utf8'));
}
