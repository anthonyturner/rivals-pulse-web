import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, hues, ratio, readRoleTokens, readTheme } from './theme-contrast.mjs';

const THEME = new URL('../src/styles.css', import.meta.url);

/** Distance between two hues on the colour wheel, in degrees. */
function apart(a, b) {
  const gap = Math.abs(a - b) % 360;
  return Math.min(gap, 360 - gap);
}

test('measures contrast the way WCAG defines it', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  assert.equal(ratio(white, black), 21);
  assert.equal(ratio(white, white), 1);
});

test('every palette pair clears its contrast threshold in both themes', () => {
  const failures = evaluate()
    .flatMap((row) => ['light', 'dark'].map((theme) => ({ row, theme, value: row[theme] })))
    .filter(({ row, value }) => !row.gap && value < row.needs)
    .map(({ row, theme, value }) => `${row.foreground} on ${row.background} (${theme}): ${value.toFixed(2)} < ${row.needs}`);
  assert.deepEqual(failures, []);
});

test('a known contrast gap still fails somewhere, so the list is not stale', () => {
  const stale = evaluate()
    .filter((row) => row.gap && row.light >= row.needs && row.dark >= row.needs)
    .map((row) => `${row.foreground} on ${row.background} now passes: remove its known-gap flag`);
  assert.deepEqual(stale, []);
});

test('the approved Aurora values are used exactly', () => {
  const { light, dark } = readTheme(readFileSync(THEME, 'utf8'));
  const approved = {
    dark: { canvas: '#090b14', surface: '#10131f', border: '#1f2436', text: '#eceefe', muted: '#8d93b3', accent: '#ffdf00', secondary: '#7b7bff', tertiary: '#e070ff', 'on-accent': '#1a1600' },
    light: { canvas: '#f3f3fa', surface: '#ffffff', border: '#e0e1ef', text: '#151735', muted: '#61668a', accent: '#b38600', secondary: '#5b55e6', tertiary: '#b44fd6', 'on-accent': '#1a1600' },
  };
  for (const [name, tokens] of Object.entries({ dark, light })) {
    for (const [token, value] of Object.entries(approved[name])) {
      assert.equal(tokens.get(`--aurora-${token}`), value, `${name} ${token}`);
    }
  }
});

test('win and loss keep one hue across themes, away from yellow and orchid', () => {
  const { light, dark } = readTheme(readFileSync(THEME, 'utf8'));
  for (const token of ['win', 'loss']) {
    assert.equal(light.get(`--aurora-${token}`), dark.get(`--aurora-${token}`), `${token} fill differs between themes`);
  }
  const win = hues('win').dark;
  const loss = hues('loss').dark;
  const accent = hues('accent');
  assert.ok(win >= 90 && win <= 150, `win hue ${win} is not a green`);
  assert.ok(apart(win, accent.dark) >= 45, 'win is too close to the yellow accent');
  assert.ok(apart(win, accent.light) >= 45, 'win is too close to the gold accent');
  assert.ok(apart(loss, hues('tertiary').dark) >= 60, 'loss is too close to orchid');
  assert.ok(apart(win, loss) >= 90, 'win and loss are too close');
});

test('measures every Aurora gradient stop and the worst point between them as large text', () => {
  const rows = evaluate().filter((row) => row.kind === 'Gradient text (large)');
  assert.deepEqual(rows.map((row) => row.foreground), ['accent', 'secondary', 'tertiary', 'a1 to a3, worst point']);
  const sweep = rows.at(-1);
  const stops = rows.slice(0, 3);
  for (const theme of ['light', 'dark']) {
    assert.ok(sweep[theme] <= Math.min(...stops.map((row) => row[theme])) + 1e-9, `${theme} sweep is not the worst point`);
  }
});

test('the dark bands hold the dark palette in both themes', () => {
  const { dark } = readTheme(readFileSync(THEME, 'utf8'));
  const roles = readRoleTokens(readFileSync(THEME, 'utf8'));
  const fixed = {
    ink: 'canvas',
    'ink-raised': 'panel',
    'ink-line': 'border-strong',
    'ink-control-border': 'control-border',
    'on-ink': 'text',
    'on-ink-muted': 'muted',
    'ink-accent': 'accent',
    'on-ink-accent': 'on-accent',
    'ink-focus': 'secondary',
  };
  for (const [band, token] of Object.entries(fixed)) {
    assert.equal(roles.get(`--${band}`), dark.get(`--aurora-${token}`), `--${band} differs from the dark ${token}`);
  }
});

test('every role token points at a palette token that exists', () => {
  const css = readFileSync(THEME, 'utf8');
  const { dark } = readTheme(css);
  const missing = [...readRoleTokens(css)]
    .flatMap(([name, value]) => [...value.matchAll(/var\((--aurora-[a-z0-9-]+)\)/g)].map((match) => [name, match[1]]))
    .filter(([, palette]) => !dark.has(palette))
    .map(([name, palette]) => `${name} -> ${palette}`);
  assert.deepEqual(missing, []);
});
