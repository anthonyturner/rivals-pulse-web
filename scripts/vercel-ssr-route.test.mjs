import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const [pageRewrite] = config.rewrites;
const matchesPageRewrite = (path) => new RegExp(`^${pageRewrite.source}$`).test(path);

test('every address that is not an API route is rendered by the server-render function', () => {
  assert.equal(config.rewrites.length, 1);
  assert.equal(matchesPageRewrite('/'), true);
  assert.equal(matchesPageRewrite('/hero-guides/nope'), true);
  assert.equal(matchesPageRewrite('/no-such-page'), true);
});

test('API routes keep their own functions instead of the server render', () => {
  assert.equal(matchesPageRewrite('/api/heroes'), false);
  assert.equal(matchesPageRewrite('/api/auth/session'), false);
});

test('the rewrite names a function file that exists, and the function ships the server build', () => {
  const file = `${pageRewrite.destination.slice(1)}.mjs`;

  assert.equal(existsSync(new URL(`../${file}`, import.meta.url)), true, `${file} is missing`);
  assert.match(config.functions[file].includeFiles, /^dist\/rivals-pulse-coach\/server\//);
});
