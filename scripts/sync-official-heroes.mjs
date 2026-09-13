import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHeroBuildProfile, buildProfileRationale } from './hero-build-profile-utils.mjs';
import { buildHeroPlaystyle } from './playstyle-utils.mjs';
import { createTursoClient, executeSchema } from './turso-client.mjs';
import {
  diffOfficialPayloads,
  scrapeOfficialHeroes,
  stableOfficialPayload,
} from './official-heroes-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const schemaPath = join(__dirname, 'sqlite-schema.sql');
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
  const db = createTursoClient();
  await executeSchema(db, readFileSync(schemaPath, 'utf8'));

  const startedAt = new Date().toISOString();
  const runId = await insertSyncRun(db, 'official-heroes', 'running', 'Checking official Marvel Rivals hero data', startedAt);

  try {
    const previous = await getPreviousPayload(db);
    const payload = await scrapeOfficialHeroes();
    const diff = diffOfficialPayloads(previous, payload);
    const statusMessage = `Official heroes: ${diff.added.length} added, ${diff.changed.length} changed, ${diff.removed.length} removed.`;

    if (!checkOnly) {
      for (const officialHero of payload.heroes) {
        await saveOfficialHero(db, officialHero);
      }
    }

    await upsertSource(
      db,
      'official-heroes',
      'Official Marvel Rivals Heroes',
      payload.sourceUrl,
      stableOfficialPayload(payload),
      payload.fetchedAt,
      'success',
      null,
    );
    await finishSyncRun(db, runId, 'success', checkOnly ? `Check only. ${statusMessage}` : statusMessage, new Date().toISOString());

    console.log(statusMessage);
    if (diff.added.length) console.log(`Added: ${diff.added.join(', ')}`);
    if (diff.changed.length) console.log(`Changed: ${diff.changed.join(', ')}`);
    if (diff.removed.length) console.log(`Removed: ${diff.removed.join(', ')}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await upsertSource(db, 'official-heroes', 'Official Marvel Rivals Heroes', 'https://www.marvelrivals.com/heroes/index.html', '{}', new Date().toISOString(), 'error', message);
    await finishSyncRun(db, runId, 'error', message, new Date().toISOString());
    throw error;
  } finally {
    db.close();
  }
}

async function saveOfficialHero(db, officialHero) {
  const legacyHeroId = legacyOfficialHeroIds[officialHero.id];
  const existing = await getExistingHero(db, officialHero.id)
    ?? (legacyHeroId ? await getExistingHero(db, legacyHeroId) : undefined);
  const existingHero = existing ? JSON.parse(existing.raw_json) : undefined;
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

  await upsertHero(db, heroWithComputedFields);
  await db.execute('DELETE FROM hero_abilities WHERE hero_id = ?', [heroWithComputedFields.id]);
  await insertAbilities(db, heroWithComputedFields.id, null, null, heroWithComputedFields.abilities);

  if (legacyHeroId && legacyHeroId !== heroWithComputedFields.id) {
    await db.execute('DELETE FROM heroes WHERE id = ?', [legacyHeroId]);
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

async function getExistingHero(db, heroId) {
  const result = await db.execute('SELECT raw_json FROM heroes WHERE id = ?', [heroId]);

  return result.rows[0];
}

async function getPreviousPayload(db) {
  const result = await db.execute('SELECT payload_json FROM external_sources WHERE source_key = ?', ['official-heroes']);
  const row = result.rows[0];

  if (!row?.payload_json || row.payload_json === '{}') {
    return undefined;
  }

  return JSON.parse(row.payload_json);
}

async function upsertHero(db, hero) {
  await db.execute(
    `INSERT INTO heroes (
      id, name, role, difficulty, summary, playstyle, image_url, raw_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      difficulty = excluded.difficulty,
      summary = excluded.summary,
      playstyle = excluded.playstyle,
      image_url = excluded.image_url,
      raw_json = excluded.raw_json,
      updated_at = CURRENT_TIMESTAMP`,
    [
      hero.id,
      hero.name,
      hero.role,
      hero.difficulty,
      hero.summary,
      hero.playstyle,
      hero.imageUrl,
      JSON.stringify(hero),
    ],
  );
}

async function insertAbilities(db, heroId, kitRole, kitLabel, abilities = []) {
  for (const [index, ability] of abilities.entries()) {
    await db.execute(
      `INSERT INTO hero_abilities (
        hero_id, kit_role, kit_label, name, ability_type, description, technical_details_json, sort_order
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        heroId,
        kitRole,
        kitLabel,
        ability.name,
        ability.type,
        ability.description,
        JSON.stringify(ability.technicalDetails ?? []),
        index,
      ],
    );
  }
}

async function insertSyncRun(db, sourceKey, status, message, startedAt) {
  const result = await db.execute(
    `INSERT INTO sync_runs (source_key, status, message, started_at)
    VALUES (?, ?, ?, ?)`,
    [sourceKey, status, message, startedAt],
  );

  return Number(result.lastInsertRowid);
}

async function finishSyncRun(db, runId, status, message, finishedAt) {
  await db.execute(
    `UPDATE sync_runs
    SET status = ?, message = ?, finished_at = ?
    WHERE id = ?`,
    [status, message, finishedAt, runId],
  );
}

async function upsertSource(db, sourceKey, sourceName, url, payloadJson, fetchedAt, status, error) {
  await db.execute(
    `INSERT INTO external_sources (
      source_key, source_name, url, payload_json, fetched_at, status, error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      source_name = excluded.source_name,
      url = excluded.url,
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at,
      status = excluded.status,
      error = excluded.error`,
    [sourceKey, sourceName, url, payloadJson, fetchedAt, status, error],
  );
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
