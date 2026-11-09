// Measures the Aurora palette in src/styles.css against WCAG 2.x contrast, in both themes. `npm run
// test:theme` fails when a pair drops below its threshold, so a palette edit cannot quietly break
// readability; `node scripts/theme-contrast.mjs` prints the table as markdown. The palette is the
// desktop app's (styles-desktop-theme.scss), ported with its checks; the pairs at the end are the
// ones only the site has.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const THEME_FILE = 'src/styles.css';
const TEXT = 4.5;
const GRAPHIC = 3;

const DARK_BLOCK = /^:root\s*\{\s*color-scheme:\s*dark;([\s\S]*?)\n\}/m;
const LIGHT_BLOCK = /^:root\[data-theme='light'\]\s*\{([\s\S]*?)\n\}/m;
const DECLARATION = /(--aurora-[a-z0-9-]+)\s*:\s*([^;]+);/g;
const ANY_DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;]+);/g;

const SURFACES = ['canvas', 'surface', 'panel', 'panel-soft', 'panel-raised', 'row-alt', 'input-bg'];
const INK_ROLES = [
  'accent', 'secondary', 'tertiary', 'win', 'loss', 'link',
  'success', 'danger', 'role-vanguard', 'role-duelist', 'role-strategist',
];

/** Declarations of one theme block, in source order. */
function declarations(block) {
  return new Map([...block.matchAll(DECLARATION)].map((match) => [match[1], match[2].trim()]));
}

/** The light and dark token maps. Dark is the base; light overrides it and inherits any token it does not set. */
export function readTheme(css) {
  const dark = declarations(css.match(DARK_BLOCK)[1]);
  const light = new Map([...dark, ...declarations(css.match(LIGHT_BLOCK)[1])]);
  return { light, dark };
}

/** Every custom property the stylesheet declares outside the two theme blocks, such as the fixed dark bands. */
export function readRoleTokens(css) {
  const outside = css.replace(DARK_BLOCK, '').replace(LIGHT_BLOCK, '');
  return new Map([...outside.matchAll(ANY_DECLARATION)].map((match) => [match[1], match[2].trim()]));
}

export function parseColour(value, tokens) {
  const reference = value.match(/^var\((--aurora-[a-z0-9-]+)\)$/);
  if (reference) return parseColour(tokens.get(reference[1]), tokens);
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)$/);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error(`Cannot read colour "${value}"`);
}

function over(top, bottom) {
  const mix = (t, b) => Math.round(t * top.a + b * (1 - top.a));
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a: 1 };
}

function luminance({ r, g, b }) {
  const linear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function ratio(foreground, background) {
  const [hi, lo] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

export function hue({ r, g, b }) {
  const [red, green, blue] = [r, g, b].map((c) => c / 255);
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);
  if (delta === 0) return 0;
  const sector = max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4;
  return Math.round(((sector * 60) + 360) % 360);
}

/** A token, or `token over surface`: a translucent tint composited over the surface it sits on. */
function resolve(tokens, name) {
  const [token, surface] = name.split(' over ');
  const colour = parseColour(tokens.get(`--aurora-${token}`), tokens);
  return surface ? over(colour, resolve(tokens, surface)) : colour;
}

/** Pairs between two theme tokens, by token suffix. */
function tokenPair(kind, foreground, background, needs, gap = false) {
  return {
    kind, foreground, background, needs, gap,
    measure: (tokens) => {
      const behind = resolve(tokens, background);
      return ratio(over(resolve(tokens, foreground), behind), behind);
    },
  };
}

/** The colour `share` of the way along stops evenly spaced from first to last, mixed in sRGB as a CSS gradient does. */
function along(stops, share) {
  const position = share * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  const t = position - index;
  const mix = (from, to) => Math.round(from + (to - from) * t);
  const [from, to] = [stops[index], stops[index + 1]];
  return { r: mix(from.r, to.r), g: mix(from.g, to.g), b: mix(from.b, to.b), a: 1 };
}

/** The least contrast anywhere along the Aurora sweep, which the three stops alone would not show. */
function gradientSweep() {
  return {
    kind: 'Gradient text (large)', foreground: 'a1 to a3, worst point', background: 'surface', needs: GRAPHIC,
    measure: (tokens) => {
      const stops = ['accent', 'secondary', 'tertiary'].map((name) => resolve(tokens, name));
      const behind = resolve(tokens, 'surface');
      return Math.min(...Array.from({ length: 101 }, (_, step) => ratio(along(stops, step / 100), behind)));
    },
  };
}

/**
 * The bands that stay dark in both themes read the fixed `--ink-*` tokens in styles.css, which hold
 * the dark palette's values; these pairs are measured on those, so they do not move with the theme.
 */
function inkBandPairs(roles) {
  const pair = (kind, foreground, background, needs) => ({
    kind, foreground, background, needs,
    measure: () => {
      const behind = parseColour(roles.get(`--${background}`), new Map());
      return ratio(over(parseColour(roles.get(`--${foreground}`), new Map()), behind), behind);
    },
  });

  return [
    ...['ink', 'ink-raised'].flatMap((band) => [
      pair('Text on a dark band', 'on-ink', band, TEXT),
      pair('Text on a dark band', 'on-ink-muted', band, TEXT),
      pair('Text on a dark band', 'ink-accent', band, TEXT),
      pair('Control boundary on a dark band', 'ink-control-border', band, GRAPHIC),
    ]),
    pair('Focus indicator on a dark band', 'ink-focus', 'ink', GRAPHIC),
    pair('Text on a dark band', 'on-ink-accent', 'ink-accent', TEXT),
  ];
}

/** Every pair the palette promises. */
function pairs(roles) {
  const list = [];
  const add = (...args) => list.push(tokenPair(...args));

  for (const surface of SURFACES) add('Text', 'text', surface, TEXT);
  for (const surface of SURFACES) add('Text', 'muted', surface, TEXT);
  for (const role of INK_ROLES) {
    for (const surface of ['surface', 'canvas', 'panel', 'panel-soft', 'panel-raised']) add('Text', `${role}-ink`, surface, TEXT);
    add('Text', `${role}-ink`, `${role}-soft over surface`, TEXT);
    // The Best to Main top-pick card runs from the surface to the role tint, so its body text sits on the tint's end.
    if (role.startsWith('role-')) {
      add('Text', 'text', `${role}-soft over surface`, TEXT);
      add('Text', 'muted', `${role}-soft over surface`, TEXT);
    }
  }
  // Text on a tint: the active nav tab (accent-soft), hovered rows, and the ally and enemy rows.
  for (const tint of ['accent-soft over surface', 'accent-soft over panel', 'hover over surface', 'hover over panel', 'ally over panel', 'enemy over panel']) {
    add('Text', 'text', tint, TEXT);
    add('Text', 'muted', tint, TEXT);
  }
  // Match History outcome words: "Victory" and "Defeat" in their outcome inks, "Result pending" muted.
  for (const surface of ['panel', 'row-alt']) {
    add('Outcome word', 'win-ink', surface, TEXT);
    add('Outcome word', 'loss-ink', surface, TEXT);
  }
  add('Outcome word', 'win-ink', 'win-soft over panel', TEXT);
  add('Outcome word', 'loss-ink', 'loss-soft over panel', TEXT);
  add('Outcome word', 'muted', 'panel-soft', TEXT);
  add('Text on fill', 'on-accent', 'accent', TEXT);
  add('Text on fill', 'on-outcome', 'win', TEXT);
  add('Text on fill', 'on-outcome', 'loss', TEXT);
  for (const surface of ['surface', 'canvas']) add('Graphic', 'faint', surface, GRAPHIC);
  for (const fill of ['win', 'loss', 'accent', 'secondary', 'tertiary']) {
    for (const surface of ['surface', 'canvas', 'panel']) add('Graphic', fill, surface, GRAPHIC);
  }
  for (const surface of ['surface', 'canvas', 'panel', 'panel-soft', 'panel-raised', 'input-bg']) {
    add('Control boundary', 'control-border', surface, GRAPHIC);
  }
  for (const surface of ['surface', 'canvas', 'panel', 'panel-raised', 'input-bg']) {
    add('Focus indicator', 'focus', surface, GRAPHIC);
  }
  // The Aurora gradient headline figures (large text, so 3:1) all sit on a surface card.
  for (const stop of ['accent', 'secondary', 'tertiary']) add('Gradient text (large)', stop, 'surface', GRAPHIC);
  for (const surface of ['surface', 'canvas']) add('Divider (exempt)', 'border', surface, 1);
  return [...list, gradientSweep(), ...inkBandPairs(roles)];
}

function readCss(root) {
  return readFileSync(`${root}/${THEME_FILE}`, 'utf8');
}

/** One row per pair, with its ratio in each theme. */
export function evaluate(root = REPO_ROOT) {
  const css = readCss(root);
  const themes = readTheme(css);
  return pairs(readRoleTokens(css)).map(({ measure, ...row }) => ({ ...row, light: measure(themes.light), dark: measure(themes.dark) }));
}

/** The hue of a token in each theme, in degrees. */
export function hues(token, root = REPO_ROOT) {
  const { light, dark } = readTheme(readCss(root));
  return { light: hue(resolve(light, token)), dark: hue(resolve(dark, token)) };
}

export function toMarkdown(rows) {
  const cell = (value, needs) => `${value.toFixed(2)}${value < needs ? ' FAIL' : ''}`;
  const lines = rows.map((row) => `| ${row.kind} | ${row.foreground} | ${row.background} | ${row.needs}:1 | ${cell(row.light, row.needs)} | ${cell(row.dark, row.needs)}${row.gap ? ' (known gap)' : ''} |`);
  return ['| Kind | Foreground | Background | Needs | Light | Dark |', '| --- | --- | --- | --- | --- | --- |', ...lines].join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(toMarkdown(evaluate()));
}
