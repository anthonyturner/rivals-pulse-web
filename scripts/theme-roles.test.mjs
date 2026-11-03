import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

/** Colours that are data or art rather than theme: the tier ramp, whose letters are the same in both themes, and the black letterbox behind a video. */
const KEPT_LITERALS = new Map([
  ['app/features/insights/tier-rows/tier-rows.component.css', 6],
  ['app/features/community/user-highlights/user-highlights-page.component.css', 1],
  ['app/features/learning/media-tutorials/media-tutorials-page.component.css', 1],
]);

/** Fill tokens read as text where the fill is not the text's own background: a large numeral, and the accent on the dark pill. */
const KEPT_FILL_TEXT = new Map([
  ['app/features/home/how-it-works/how-it-works.component.css', 1],
  ['app/shared/components/get-app-button/get-app-button.component.css', 1],
]);

const COLOUR_LITERAL = /(?<![&\w])#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi;

/** A fill is rated 3:1 for shapes; text needs its `-ink` or `-strong` token, and faint is for graphics only. */
const FILL_AS_TEXT = /^\s*color\s*:\s*var\(--(?:accent|danger|secondary|tertiary|win|loss|role-[a-z]+|text-faint)\)/gm;

function files(dir, extensions) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return files(path, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [path] : [];
  });
}

const read = (path) => ({ name: relative(SRC, path).replaceAll('\\', '/'), text: readFileSync(path, 'utf8') });
const componentStyles = files(join(SRC, 'app'), ['.css']).map(read);
const templates = files(join(SRC, 'app'), ['.html', '.ts']).filter((path) => !path.endsWith('.spec.ts')).map(read);

/** The style attributes in a template and the `styles` blocks in a component, which a stylesheet scan would miss. */
function inlineStyles({ text }) {
  const attributes = [...text.matchAll(/\bstyle\s*=\s*"([^"]*)"/g)].map((match) => match[1]);
  const bindings = [...text.matchAll(/\[style\.[a-z-]+\]\s*=\s*"([^"]*)"/g)].map((match) => match[1]);
  const blocks = [...text.matchAll(/styles\s*:\s*\[?\s*`([\s\S]*?)`/g)].map((match) => match[1]);
  return [...attributes, ...bindings, ...blocks].join('\n');
}

const count = (text, pattern) => (text.match(pattern) ?? []).length;

test('no component stylesheet reads the palette directly', () => {
  const offenders = [...componentStyles, ...templates]
    .filter(({ text }) => text.includes('--aurora-'))
    .map(({ name }) => name);
  assert.deepEqual(offenders, []);
});

test('no component stylesheet carries a colour of its own', () => {
  const offenders = componentStyles
    .map(({ name, text }) => ({ name, found: count(text, COLOUR_LITERAL), allowed: KEPT_LITERALS.get(name) ?? 0 }))
    .filter(({ found, allowed }) => found !== allowed)
    .map(({ name, found, allowed }) => `${name}: ${found} colour literals, ${allowed} allowed`);
  assert.deepEqual(offenders, []);
});

test('no inline style or template carries a colour of its own', () => {
  const offenders = templates
    .map((source) => ({ name: source.name, found: count(inlineStyles(source), COLOUR_LITERAL) }))
    .filter(({ found }) => found > 0)
    .map(({ name, found }) => `${name}: ${found} colour literals in inline styles`);
  assert.deepEqual(offenders, []);
});

test('text uses an -ink or -strong token, never a fill or the faint token', () => {
  const offenders = componentStyles
    .map(({ name, text }) => ({ name, found: count(text, FILL_AS_TEXT), allowed: KEPT_FILL_TEXT.get(name) ?? 0 }))
    .filter(({ found, allowed }) => found !== allowed)
    .map(({ name, found, allowed }) => `${name}: ${found} fill or faint colours as text, ${allowed} allowed`);
  assert.deepEqual(offenders, []);
});

test('every custom property a stylesheet reads is declared somewhere', () => {
  const sources = [...componentStyles, ...files(SRC, ['.css', '.html', '.ts']).map(read)];
  const declared = new Set(sources.flatMap(({ text }) => [...text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1])));
  const unknown = componentStyles
    .flatMap(({ name, text }) => [...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((match) => `${name}: ${match[1]}`))
    .filter((use) => !declared.has(use.split(': ')[1]));
  assert.deepEqual([...new Set(unknown)], []);
});
