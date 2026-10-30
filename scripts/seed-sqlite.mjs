import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient, executeSchema } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const schemaPath = join(__dirname, 'sqlite-schema.sql');
const homePortalsPath = join(projectRoot, 'data', 'seeds', 'home-portals.mock.json');
const homeContentPath = join(projectRoot, 'data', 'seeds', 'home-content.mock.json');

const db = createTursoClient();
const schema = readFileSync(schemaPath, 'utf8');
const homePortals = JSON.parse(readFileSync(homePortalsPath, 'utf8'));
const homeContent = JSON.parse(readFileSync(homeContentPath, 'utf8'));

await executeSchema(db, schema);
await seed();

const portalCount = await getCount('home_portals');
const homeContentCount = await getCount('home_content_blocks');

db.close();

console.log('Seeded Turso database.');
console.log(`Home portals: ${portalCount}`);
console.log(`Home content blocks: ${homeContentCount}`);

async function seed() {
  await db.execute('DELETE FROM home_portals');
  await db.execute('DELETE FROM home_content_blocks');

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

async function getCount(tableName) {
  const result = await db.execute(`SELECT COUNT(*) AS count FROM ${tableName}`);

  return result.rows[0]?.count ?? 0;
}
