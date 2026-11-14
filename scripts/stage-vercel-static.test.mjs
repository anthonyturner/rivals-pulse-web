import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { stageVercelStatic } from './stage-vercel-static.mjs';

function listing(folder, prefix = '') {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listing(join(folder, entry.name), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  );
}

test('stages every static file but the browser shell', async () => {
  const root = mkdtempSync(join(tmpdir(), 'stage-static-'));
  const browser = join(root, 'browser');
  const staged = join(root, 'static');

  try {
    mkdirSync(join(browser, 'images'), { recursive: true });
    mkdirSync(staged);
    writeFileSync(join(staged, 'left-over.txt'), 'from an earlier run');
    for (const name of ['index.csr.html', 'index.html', 'main-ABC.js', 'robots.txt', 'images/logo.svg']) {
      writeFileSync(join(browser, name), name);
    }
    // A page in a folder of its own is not the shell.
    mkdirSync(join(browser, 'docs'));
    writeFileSync(join(browser, 'docs', 'index.html'), 'docs');

    await stageVercelStatic(browser, staged);

    assert.deepEqual(listing(staged).sort(), ['docs/index.html', 'images/logo.svg', 'main-ABC.js', 'robots.txt']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
