import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];

/** Runs the inline script against a stand-in browser and returns the `data-theme` it set. */
function themeSet({ saved, prefersLight, storageThrows = false, noMatchMedia = false }) {
  let attribute = null;
  const window = {
    localStorage: {
      getItem(key) {
        if (storageThrows) throw new Error('blocked');
        return key === 'rp.web-theme' ? saved ?? null : null;
      },
    },
    matchMedia: noMatchMedia ? undefined : (query) => ({ matches: query === '(prefers-color-scheme: light)' && prefersLight }),
  };
  const sandbox = {
    ...window,
    window,
    document: { documentElement: { setAttribute: (name, value) => { if (name === 'data-theme') attribute = value; } } },
  };
  runInNewContext(script, sandbox);
  return attribute;
}

test('index.html sets the theme in an inline script', () => {
  assert.ok(script, 'no inline script in the head');
  assert.ok(html.indexOf('<script>') < html.indexOf('<title>'), 'the script must run before the page is styled');
});

test('a saved choice wins over the device setting', () => {
  assert.equal(themeSet({ saved: 'light', prefersLight: false }), 'light');
  assert.equal(themeSet({ saved: 'dark', prefersLight: true }), 'dark');
});

test('with no saved choice it follows the device, and falls back to dark', () => {
  assert.equal(themeSet({ prefersLight: true }), 'light');
  assert.equal(themeSet({ prefersLight: false }), 'dark');
  assert.equal(themeSet({ saved: 'purple', prefersLight: false }), 'dark');
  assert.equal(themeSet({ noMatchMedia: true }), 'dark');
});

test('blocked storage still gets the device setting', () => {
  assert.equal(themeSet({ storageThrows: true, prefersLight: true }), 'light');
  assert.equal(themeSet({ storageThrows: true, prefersLight: false }), 'dark');
});
