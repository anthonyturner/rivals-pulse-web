import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHeroBuildProfile, buildProfileRationale } from './hero-build-profile-utils.mjs';
import { buildHeroPlaystyle, isGenericPlaystyle } from './playstyle-utils.mjs';
import { columnExists, createTursoClient, executeSchema } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const schemaPath = join(__dirname, 'sqlite-schema.sql');
const heroesPath = join(projectRoot, 'data', 'seeds', 'heroes.mock.json');
const glossaryPath = join(projectRoot, 'data', 'seeds', 'glossary.mock.json');
const heroVideosPath = join(projectRoot, 'data', 'seeds', 'hero-videos.mock.json');
const homePortalsPath = join(projectRoot, 'data', 'seeds', 'home-portals.mock.json');
const homeContentPath = join(projectRoot, 'data', 'seeds', 'home-content.mock.json');

const db = createTursoClient();
const schema = readFileSync(schemaPath, 'utf8');
const heroes = JSON.parse(readFileSync(heroesPath, 'utf8'));
const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const heroVideos = JSON.parse(readFileSync(heroVideosPath, 'utf8'));
const homePortals = JSON.parse(readFileSync(homePortalsPath, 'utf8'));
const homeContent = JSON.parse(readFileSync(homeContentPath, 'utf8'));

await executeSchema(db, schema);
await migrateAbilityTechnicalDetails();
await seed();

const heroCount = await getCount('heroes');
const glossaryCount = await getCount('glossary_terms');
const abilityCount = await getCount('hero_abilities');
const videoCount = await getCount('hero_videos');
const portalCount = await getCount('home_portals');
const homeContentCount = await getCount('home_content_blocks');

db.close();

console.log('Seeded Turso database.');
console.log(`Heroes: ${heroCount}`);
console.log(`Hero abilities: ${abilityCount}`);
console.log(`Hero videos: ${videoCount}`);
console.log(`Home portals: ${portalCount}`);
console.log(`Home content blocks: ${homeContentCount}`);
console.log(`Glossary terms: ${glossaryCount}`);

async function seed() {
  await db.execute('DELETE FROM hero_abilities');
  await db.execute('DELETE FROM hero_list_items');
  await db.execute('DELETE FROM hero_videos');
  await db.execute('DELETE FROM home_portals');
  await db.execute('DELETE FROM home_content_blocks');
  await db.execute('DELETE FROM heroes');
  await db.execute('DELETE FROM glossary_terms');

  for (const hero of heroes) {
    const seededHero = {
      ...hero,
      playstyle: isGenericPlaystyle(hero.playstyle) ? buildHeroPlaystyle(hero) : hero.playstyle,
    };
    const buildProfile = buildHeroBuildProfile(seededHero);
    const seededHeroWithProfile = {
      ...seededHero,
      buildProfile,
      buildProfileRationale: buildProfileRationale(seededHero, buildProfile),
    };

    await db.execute(
      `INSERT INTO heroes (
        id, name, role, difficulty, summary, playstyle, image_url, raw_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        seededHero.id,
        seededHero.name,
        seededHero.role,
        seededHero.difficulty,
        seededHero.summary,
        seededHero.playstyle,
        seededHero.imageUrl,
        JSON.stringify(seededHeroWithProfile),
      ],
    );

    await insertListItems(seededHero.id, 'strength', seededHero.strengths);
    await insertListItems(seededHero.id, 'weakness', seededHero.weaknesses);
    await insertListItems(seededHero.id, 'counter', seededHero.counters);
    await insertListItems(seededHero.id, 'synergy', seededHero.synergies);
    await insertAbilities(seededHero.id, null, null, seededHero.abilities);

    for (const kit of seededHero.roleAbilityKits ?? []) {
      await insertAbilities(seededHero.id, kit.role, kit.label, kit.abilities);
    }
  }

  for (const term of glossaryTerms) {
    await db.execute(
      `INSERT INTO glossary_terms (
        id, term, category, definition, coach_note, example, related_terms_json,
        source_name, source_url, raw_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        term.id,
        term.term,
        term.category,
        term.definition,
        term.coachNote,
        term.example,
        JSON.stringify(term.relatedTerms ?? []),
        term.sourceName,
        term.sourceUrl,
        JSON.stringify(term),
      ],
    );
  }

  for (const [index, video] of heroVideos.entries()) {
    await db.execute(
      `INSERT INTO hero_videos (
        hero_id, role, video_type, youtube_id, title, sort_order, raw_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        video.heroId ?? null,
        video.role ?? null,
        video.videoType,
        video.id,
        video.title,
        index,
        JSON.stringify(video),
      ],
    );
  }

  for (const [index, portal] of homePortals.entries()) {
    await db.execute(
      `INSERT INTO home_portals (
        title, description, path, image, sort_order, raw_json, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        portal.title,
        portal.description,
        portal.path,
        portal.image,
        index,
        JSON.stringify(portal),
      ],
    );
  }

  for (const [key, value] of Object.entries(homeContent)) {
    await db.execute(
      `INSERT INTO home_content_blocks (content_key, payload_json, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [key, JSON.stringify(value)],
    );
  }
}

async function insertListItems(heroId, itemType, values = []) {
  for (const [index, value] of values.entries()) {
    await db.execute(
      `INSERT INTO hero_list_items (hero_id, item_type, value, sort_order)
      VALUES (?, ?, ?, ?)`,
      [heroId, itemType, value, index],
    );
  }
}

async function insertAbilities(heroId, kitRole, kitLabel, abilities = []) {
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

async function migrateAbilityTechnicalDetails() {
  if (!(await columnExists(db, 'hero_abilities', 'technical_details_json'))) {
    await db.execute("ALTER TABLE hero_abilities ADD COLUMN technical_details_json TEXT NOT NULL DEFAULT '[]'");
  }
}

async function getCount(tableName) {
  const result = await db.execute(`SELECT COUNT(*) AS count FROM ${tableName}`);

  return result.rows[0]?.count ?? 0;
}
