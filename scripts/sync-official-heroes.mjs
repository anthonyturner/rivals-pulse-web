import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHeroBuildProfile, buildProfileRationale } from './hero-build-profile-utils.mjs';
import { buildHeroPlaystyle } from './playstyle-utils.mjs';
import { deleteHero, getHero, saveHero } from '../src/hero-store.ts';
import { finishSyncRun, getExternalSourcePayload, saveExternalSource, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';
import {
  diffOfficialPayloads,
  scrapeOfficialHeroes,
  stableOfficialPayload,
} from './official-heroes-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const heroImagesPath = join(projectRoot, 'public', 'images', 'heroes');
const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check') || args.has('--check-only');
const watch = args.has('--watch');
const intervalDays = getNumberArg('--interval-days', 3);
const legacyOfficialHeroIds = {
  jubilee: 'jubilation-lee',
};

if (watch) {
  await runOnce();
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  console.log(`Watching official hero data every ${intervalDays} day(s).`);
  setInterval(() => {
    runOnce().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  }, intervalMs);
} else {
  await runOnce();
}

async function runOnce() {
  const db = getSupabaseClient();
  const runId = await startSyncRun(db, 'official-heroes', 'Checking official Marvel Rivals hero data');

  try {
    const previous = await getExternalSourcePayload(db, 'official-heroes');
    const payload = await scrapeOfficialHeroes();
    const diff = diffOfficialPayloads(previous, payload);
    const statusMessage = `Official heroes: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed.`;

    if (!checkOnly) {
      for (const officialHero of payload.heroes) {
        await saveOfficialHero(db, officialHero);
      }
    }

    await saveExternalSource(db, {
      sourceKey: 'official-heroes',
      sourceName: 'Official Marvel Rivals Heroes',
      url: payload.sourceUrl,
      payload: stableOfficialPayload(payload),
      fetchedAt: payload.fetchedAt,
      status: 'success',
      error: null,
    });
    await finishSyncRun(db, runId, {
      status: 'success',
      message: checkOnly ? `Check only. ${statusMessage}` : statusMessage,
      details: { checkOnly, ...diff },
    });

    console.log(statusMessage);
    if (diff.added.length) console.log(`Added: ${diff.added.join(', ')}`);
    if (diff.changed.length) console.log(`Changed: ${diff.changed.join(', ')}`);
    if (diff.removed.length) console.log(`Removed: ${diff.removed.join(', ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await saveExternalSource(db, {
      sourceKey: 'official-heroes',
      sourceName: 'Official Marvel Rivals Heroes',
      url: 'https://www.marvelrivals.com/heroes/index.html',
      payload: {},
      fetchedAt: new Date().toISOString(),
      status: 'error',
      error: message,
    });
    await finishSyncRun(db, runId, { status: 'error', message });
    throw error;
  }
}

async function saveOfficialHero(db, officialHero) {
  const legacyHeroId = legacyOfficialHeroIds[officialHero.id];
  const existingHero = await getHero(db, officialHero.id)
    ?? (legacyHeroId ? await getHero(db, legacyHeroId) : undefined);
  const officialAbilities = officialHero.abilities.map(({ iconUrl, source, ...ability }) => ability);
  const mergedHero = {
    ...(existingHero ?? {}),
    id: officialHero.id,
    name: officialHero.name,
    role: officialHero.role,
    difficulty: existingHero?.difficulty ?? 3,
    summary: officialHero.summary || existingHero?.summary || `${officialHero.name} is a ${officialHero.role} hero in Marvel Rivals.`,
    overview: officialHero.lore || existingHero?.overview || officialHero.summary,
    officialSource: {
      id: officialHero.officialId,
      sourceUrl: officialHero.sourceUrl,
      subtitle: officialHero.subtitle,
      baseStats: officialHero.baseStats,
      baseStatKits: officialHero.baseStatKits,
      fetchedFrom: 'https://www.marvelrivals.com/heroes/index.html',
    },
    abilities: officialAbilities.length > 0 ? officialAbilities : existingHero?.abilities ?? [],
    strengths: existingHero?.strengths ?? fallbackStrengths(officialHero.role),
    weaknesses: existingHero?.weaknesses ?? fallbackWeaknesses(officialHero.role),
    counters: existingHero?.counters ?? [],
    synergies: officialTeamUpNames(officialAbilities, existingHero?.synergies ?? []),
    imageUrl: getImageUrl(officialHero.id, existingHero?.imageUrl, officialHero.listImageUrl),
  };
  const heroWithComputedFields = withBuildProfile({
    ...mergedHero,
    playstyle: buildHeroPlaystyle(mergedHero),
  });

  await saveHero(db, heroWithComputedFields);

  if (legacyHeroId && legacyHeroId !== heroWithComputedFields.id) {
    await deleteHero(db, legacyHeroId);
  }
}

function getImageUrl(heroId, existingImageUrl, officialImageUrl) {
  if (existingImageUrl && !existingImageUrl.includes('default-hero')) {
    return existingImageUrl;
  }

  if (existsSync(join(heroImagesPath, `${heroId}.png`))) {
    return `/images/heroes/${heroId}.png`;
  }

  // A hero added mid-season has no committed portrait yet, so the official
  // image keeps the card correct until `sync:official-hero-images` runs.
  return officialImageUrl || '/images/heroes/default-hero.png';
}

function withBuildProfile(hero) {
  const buildProfile = buildHeroBuildProfile(hero);

  return {
    ...hero,
    buildProfile,
    buildProfileRationale: buildProfileRationale(hero, buildProfile),
  };
}

function officialTeamUpNames(abilities, existingSynergies) {
  const names = new Set(existingSynergies);

  for (const ability of abilities.filter((item) => item.type === 'Team-Up Ability')) {
    for (const match of ability.description.matchAll(/\b(?:with|teaming up with)\s+([A-Z][A-Za-z -]+?)(?:,|\.|$)/gi)) {
      names.add(match[1].trim());
    }
  }

  return [...names].slice(0, 5);
}

function fallbackStrengths(role) {
  return role === 'Vanguard'
    ? ['Creates space for the team', 'Absorbs pressure', 'Controls close fights']
    : role === 'Strategist'
      ? ['Supports allies', 'Stabilizes team fights', 'Adds utility from the backline']
      : ['Deals reliable damage', 'Pressures exposed targets', 'Creates elimination windows'];
}

function fallbackWeaknesses(role) {
  return role === 'Vanguard'
    ? ['Can be kited', 'Punished by split angles', 'Needs support timing']
    : role === 'Strategist'
      ? ['Vulnerable to dives', 'Needs safe positioning', 'Struggles when isolated']
      : ['Punished by crowd control', 'Needs clean angles', 'Can struggle into heavy peel'];
}

function getNumberArg(name, fallback) {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  const parsed = Number.parseFloat(process.argv[index + 1]);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
