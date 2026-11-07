import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Server-only Supabase code must never reach the browser: the service role key
// bypasses row-level security on every table.
const FORBIDDEN = ['SUPABASE_SERVICE_ROLE_KEY', 'sb_secret_', '@supabase/supabase-js'];

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const browserRoot = join(projectRoot, 'dist', 'rivals-pulse-coach', 'browser');

if (!existsSync(browserRoot)) {
  console.error(`No browser build at ${relative(projectRoot, browserRoot)}. Run npm run build first.`);
  process.exit(1);
}

const findings = listFiles(browserRoot).flatMap((path) => {
  const text = readFileSync(path, 'utf8');

  return FORBIDDEN.filter((needle) => text.includes(needle)).map(
    (needle) => `${relative(projectRoot, path)} contains ${needle}`,
  );
});

if (findings.length > 0) {
  console.error(`Server-only Supabase code reached the browser build:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log('Browser build is free of server-only Supabase code.');

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
