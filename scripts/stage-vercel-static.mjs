// Copies the browser build into the folder Vercel serves as static files, leaving out the browser
// shell, so no file can answer `/` (or `/index.html`) before the rewrite to the server render.
//
//   node scripts/stage-vercel-static.mjs [browser-folder] [static-folder]
//
// Vercel serves a file before any rewrite. The shell stays in the browser folder, where the server
// render reads it (`api/ssr.mjs` ships it through `includeFiles`).
import { cp, rm } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildRoot = join(repoRoot, 'dist', 'rivals-pulse-coach');

/** The files that must not be served as static pages: each is the app's page for every address. */
export const SHELL_FILES = new Set(['index.html', 'index.csr.html']);

export async function stageVercelStatic(browserFolder, staticFolder) {
  const from = resolve(browserFolder);
  const to = resolve(staticFolder);

  await rm(to, { recursive: true, force: true });
  await cp(from, to, {
    recursive: true,
    filter: (source) => !(dirname(resolve(source)) === from && SHELL_FILES.has(basename(source))),
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const browserFolder = resolve(process.argv[2] ?? join(buildRoot, 'browser'));
  const staticFolder = resolve(process.argv[3] ?? join(buildRoot, 'static'));

  await stageVercelStatic(browserFolder, staticFolder);
  console.log(`Staged ${browserFolder} to ${staticFolder} without the browser shell.`);
}
