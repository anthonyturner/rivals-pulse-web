import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { ADMIN_ROUTES } from '../src/server/admin/admin-routes.ts';

/**
 * ADR-0005 says no admin route exists outside the one wrapper, in either router. Express mounts the
 * whole `/api/admin/` prefix (so it cannot miss a route); Vercel serves one file per route, so the
 * files are what could drift, and these tests read them. The wrapper's behaviour is tested in
 * `src/server/admin/*.spec.ts`.
 */
const root = new URL('../', import.meta.url);
const ADMIN_API = new URL('api/admin/', root);
const ADMIN_SERVER = new URL('src/server/admin/', root);

const everyEntry = readdirSync(ADMIN_API, { recursive: true }).map(String);
const routeFiles = everyEntry.filter((name) => name.endsWith('.ts'));

describe('the Vercel files for the admin routes', () => {
  it('sit directly in api/admin/, never in a folder, so each is one route the wrapper knows', () => {
    assert.deepEqual(
      everyEntry.filter((name) => !/^[^/\\]+\.ts$/.test(name)),
      [],
    );
  });

  it('are one per route in ADMIN_ROUTES, and no route lacks one', () => {
    assert.deepEqual(
      routeFiles.map((name) => `admin/${name.replace(/\.ts$/, '')}`).sort(),
      Object.keys(ADMIN_ROUTES).sort(),
    );
  });

  for (const name of routeFiles) {
    it(`${name} does nothing but hand its route to the wrapper`, () => {
      const source = readFileSync(new URL(name, ADMIN_API), 'utf8').replace(/\r\n/g, '\n').trim();
      const route = `admin/${name.replace(/\.ts$/, '')}`;

      assert.equal(
        source,
        `import { adminRouteHandler } from '../../src/server/admin/index.ts';\n\nexport default adminRouteHandler('${route}');`,
      );
    });
  }
});

describe('the Express mount', () => {
  it('sends the whole /api/admin/ prefix through the wrapper, and nothing else answers it', () => {
    const server = readFileSync(new URL('src/server.ts', root), 'utf8').replace(/\r\n/g, '\n');
    const mounts = server.split('\n').filter((line) => line.includes('/api/admin'));
    const mount = server.match(/app\.all\('\/api\/admin\/\*splat', [\s\S]*?\n\}\);/)?.[0] ?? '';

    assert.equal(mounts.length, 1, 'one mount names the admin prefix');
    assert.match(mount, /handleAdminHttp\(req, res, /);
  });
});

describe('the admin handlers', () => {
  const sources = readdirSync(ADMIN_SERVER)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
    .map((name) => ({ name, source: readFileSync(new URL(name, ADMIN_SERVER), 'utf8') }));

  it('exist to read', () => {
    assert.ok(sources.length > 0);
  });

  for (const { name, source } of sources) {
    it(`${name} never reads the service-role key (ADR-0005, decision 6)`, () => {
      const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

      assert.doesNotMatch(code, /service[_-]?role/i);
      assert.doesNotMatch(code, /sb_secret_/);
      assert.doesNotMatch(code, /SERVICE_ROLE_KEY/);
    });
  }

  it('answer only through the shared private writer, which sets Cache-Control', () => {
    const http = sources.find(({ name }) => name === 'admin-http.ts')?.source ?? '';

    assert.match(http, /respondPrivately\(/);
    assert.doesNotMatch(http, /writeHead|setHeader|\.end\(/);
  });
});
