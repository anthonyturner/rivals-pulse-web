import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient, executeSchema } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const schemaPath = join(__dirname, 'sqlite-schema.sql');
const glossaryPath = join(projectRoot, 'data', 'seeds', 'glossary.mock.json');
const heroVideosPath = join(projectRoot, 'data', 'seeds', 'hero-videos.mock.json');

const db = createTursoClient();
const schema = readFileSync(schemaPath, 'utf8');
const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const heroVideos = JSON.parse(readFileSync(heroVideosPath, 'utf8'));

await executeSchema(db, schema);
await seed();

const glossaryCount = await getCount('glossary_terms');
const videoCount = await getCount('hero_videos');

db.close();

console.log('Seeded Turso database.');
console.log(`Hero videos: ${videoCount}`);
console.log(`Glossary terms: ${glossaryCount}`);

async function seed() {
  await db.execute('DELETE FROM hero_videos');
  await db.execute('DELETE FROM glossary_terms');

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
}

async function getCount(tableName) {
  const result = await db.execute(`SELECT COUNT(*) AS count FROM ${tableName}`);

  return result.rows[0]?.count ?? 0;
}
