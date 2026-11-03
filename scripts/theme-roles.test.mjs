import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Colours that are data rather than theme: the tier ramp, whose letters are the same in both themes. */
const KEPT_LITERALS = new Map([['app/features/insights/tier-rows/tier-rows.component.css', 6]]);

const COLOUR_LITERAL = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi;

function files(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

const componentStyles = files(join(SRC, 'app'), ['.css']).map((path) => ({
  name: relative(SRC, path).replaceAll('\\', '/'),
  text: readFileSync(path, 'utf8'),
}));

test('no component stylesheet reads the palette directly', () => {
  const offenders = componentStyles.filter(({ text }) => text.includes('--aurora-')).map(({ name }) => name);
  assert.deepEqual(offenders, []);
});

test('no component stylesheet carries a colour of its own', () => {
  const offenders = componentStyles
    .map(({ name, text }) => ({ name, found: (text.match(COLOUR_LITERAL) ?? []).length, allowed: KEPT_LITERALS.get(name) ?? 0 }))
    .filter(({ found, allowed }) => found !== allowed)
    .map(({ name, found, allowed }) => `${name}: ${found} colour literals, ${allowed} allowed`);
  assert.deepEqual(offenders, []);
});

test('every custom property a stylesheet reads is declared somewhere', () => {
  const sources = [...componentStyles, ...files(SRC, ['.css', '.html', '.ts']).map((path) => ({
    name: relative(SRC, path).replaceAll('\\', '/'),
    text: readFileSync(path, 'utf8'),
  }))];
  const declared = new Set(sources.flatMap(({ text }) => [...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])));
  const unknown = componentStyles
    .flatMap(({ name, text }) => [...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => `${name}: ${match[1]}`))
    .filter((use) => !declared.has(use.split(': ')[1]));
  assert.deepEqual([...new Set(unknown)], []);
});
