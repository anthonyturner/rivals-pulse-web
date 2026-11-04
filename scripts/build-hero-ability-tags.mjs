// Rebuilds src/server/community/extended/hero-ability-tags.table.json from the saved official hero
// pages and the hero kit mobility table. The rules are in docs/hero-build-scores.md. A tag is written
// only when the rules point at exactly one tag; anything else stays untagged, with the reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL = 'data/turso-cutover/106/external-sources-official-heroes.json';
const MOBILITY = 'src/app/features/heroes/hero-kit-mobility.table.json';
const OUTPUT = 'src/server/community/extended/hero-ability-tags.table.json';
const UNTAGGED_LIST = 'docs/hero-ability-untagged.md';

const SLOT_BY_KEY = new Map([
  ['right click', 'ability_0'],
  ['shift', 'ability_1'],
  ['e', 'ability_2'],
  ['f', 'ability_3'],
  ['c', 'team_up_0'],
  ['q', 'ultimate'],
]);

// Each tag's evidence, in the official wording. Delivery words such as "launch", "throw" and "fire" are
// left out on purpose: they say how an ability travels, not what it does.
const DESCRIPTION_SIGNALS = {
  // Any damage done to someone. A boost, a cut or damage the hero takes is not damage dealt.
  Damage:
    /(?<!(?:incoming|absorbing|taking|you take|amplify|reducing) )\bdamag\w*\b(?! (?:boost|reduction|increase|taken|received|passing))/i,
  Sustain:
    /\b(heal\w*|restor\w* (?:\w+ )?health|bonus health|regenerat\w*|shields?|barriers?|protect\w*|invincib\w*|damage reduction|lifesteal)\b/i,
  Mobility: /\b(dash\w*|leap\w*|fly\w*|flight|glid\w*|soar\w*|teleport\w*|blink\w*|jump\w*|swing\w*|sprint\w*|lunge\w*|burrow\w*)\b/i,
  Utility:
    /\b(stun\w*|slow\w*|freez\w*|root\w*|imprison\w*|immobili\w*|knock\w*|pull\w*|push\w*|taunt\w*|blind\w*|silenc\w*|charm\w*|reveal\w*|sleep\w*|slumber\w*|sedat\w*|boost\w*|revive\w*|resurrect\w*|invisib\w*|stealth\w*|cleans\w*|disrupt\w*|portal\w*|tether\w*|cocoon\w*|trap\w*)\b/i,
};

// The same four ideas in the names of the page's detail rows. Rows that only qualify another row
// (a falloff, a cooldown cut) carry no signal.
const LABEL_SIGNALS = {
  Damage: /damage/i,
  Sustain: /healing|health restored|bonus health|bonus max health|shield value|damage reduction/i,
  Mobility: /dash|movement boost|jump distance|flight speed/i,
  Utility: /stun|slow|freeze|immobili|knock|charm|taunt|silence|damage boost|healing boost|pull|reveal|sleep/i,
};
const LABEL_NOISE = /falloff|reduction per|boost per|cd reduction|from per/i;
const NOT_DAMAGE_DEALT = /damage (?:boost|reduction|dealt to self|taken)|reduced damage/i;

const official = JSON.parse(readFileSync(join(repoRoot, OFFICIAL), 'utf8'));
const mobility = JSON.parse(readFileSync(join(repoRoot, MOBILITY), 'utf8'));
const movementByHero = new Map(
  mobility.heroes.map((hero) => [hero.heroId, new Set(hero.abilities.map((row) => row.ability.toLowerCase()))]),
);

function descriptionSignals(description) {
  return Object.entries(DESCRIPTION_SIGNALS).flatMap(([tag, pattern]) => {
    const found = pattern.exec(description ?? '');

    return found ? [{ tag, field: 'description', raw: found[0] }] : [];
  });
}

function labelSignals(details) {
  const found = new Map();

  for (const { label, value } of details) {
    if (label === 'Key' || LABEL_NOISE.test(label)) {
      continue;
    }

    for (const [tag, pattern] of Object.entries(LABEL_SIGNALS)) {
      if (pattern.test(label) && !found.has(tag) && !(tag === 'Damage' && NOT_DAMAGE_DEALT.test(label))) {
        found.set(tag, { tag, field: label, raw: String(value).slice(0, 60) });
      }
    }
  }

  return [...found.values()];
}

const describe = (signals) => signals.map((signal) => `${signal.tag} (${signal.field}: ${signal.raw})`).join('; ');

// The one-line description is the page's own statement of what the ability is for, so it decides. An
// incidental number does not outvote it: a stun with a little damage attached is still a stun. The
// detail rows decide only when the description names no effect.
function decideTag(hero, ability) {
  if (movementByHero.get(hero.id)?.has(ability.name.toLowerCase())) {
    return { tag: 'Mobility', evidence: { source: 'hero-kit-mobility', field: 'abilities', raw: ability.name } };
  }

  if (ability.type === 'Normal Attack') {
    return { tag: 'Damage', evidence: { source: 'official-kit', field: 'type', raw: ability.type } };
  }

  const inDescription = descriptionSignals(ability.description);
  const signals = inDescription.length > 0 ? inDescription : labelSignals(ability.technicalDetails ?? []);

  if (signals.length === 1) {
    const [{ tag, field, raw }] = signals;

    return { tag, evidence: { source: 'official-kit', field, raw } };
  }

  return {
    tag: null,
    reason: signals.length === 0 ? 'The page names no effect these rules know.' : `More than one tag: ${describe(signals)}`,
  };
}

function keysOf(ability) {
  return (ability.technicalDetails ?? []).filter((detail) => detail.label === 'Key').map((detail) => String(detail.value));
}

// A plain number of seconds only. "3s after it breaks" is not a time between uses this can trust.
function cooldownOf(ability) {
  const row = (ability.technicalDetails ?? []).find((detail) => detail.label === 'Cooldown');
  const match = row ? /^\s*(\d+(?:\.\d+)?)\s*s?\s*$/i.exec(String(row.value)) : null;

  return match && Number(match[1]) > 0 ? { value: Number(match[1]), raw: String(row.value) } : null;
}

const heroes = official.heroes.map((hero) => ({
  heroId: hero.id,
  name: hero.name,
  abilities: hero.abilities.map((ability) => {
    const slots = [...new Set(keysOf(ability).map((key) => SLOT_BY_KEY.get(key.toLowerCase())).filter(Boolean))];

    return {
      ability: ability.name,
      type: ability.type,
      keys: keysOf(ability),
      slot: slots.length === 1 ? slots[0] : null,
      cooldown: cooldownOf(ability),
      ...decideTag(hero, ability),
    };
  }),
}));

const table = {
  sources: {
    'official-kit': {
      label: `Official hero pages on marvelrivals.com, as saved in ${OFFICIAL}`,
      url: official.sourceUrl,
      note: 'The saved copy the hero kit mobility table was checked against; its live pages were compared with it on 2026-11-04.',
    },
    'hero-kit-mobility': {
      label: `The hero kit mobility table, ${MOBILITY}`,
      url: 'docs/hero-kit-mobility.md',
      note: "An ability that table lists is the hero's own movement.",
    },
  },
  heroes,
};

writeFileSync(join(repoRoot, OUTPUT), `${JSON.stringify(table, null, 1)}\n`);

const rows = heroes.flatMap((hero) => hero.abilities);
const untaggedOnSlots = heroes.flatMap((hero) =>
  hero.abilities.filter((row) => row.tag === null && row.slot !== null).map((row) => ({ hero, row })),
);
const untaggedElsewhere = rows.filter((row) => row.tag === null && row.slot === null).length;
const cell = (text) => text.replaceAll('|', '/');

writeFileSync(
  join(repoRoot, UNTAGGED_LIST),
  [
    '# Hero abilities left untagged',
    '',
    'Written by `scripts/build-hero-ability-tags.mjs`; do not edit by hand. The rules are in',
    '[hero-build-scores.md](hero-build-scores.md).',
    '',
    `The official pages could not decide a tag for ${rows.filter((row) => row.tag === null).length} of ${rows.length} abilities, so none of them counts toward Utility.`,
    `${untaggedElsewhere} of them are on a key the overlay does not count, such as Left Click, Space or a passive. The ${untaggedOnSlots.length} below are on a key it counts.`,
    '',
    '| Hero | Slot | Ability | Why |',
    '| --- | --- | --- | --- |',
    ...untaggedOnSlots.map(({ hero, row }) => `| ${hero.name} | ${row.slot} | ${cell(row.ability)} | ${cell(row.reason)} |`),
    '',
  ].join('\n'),
);


console.log(`${heroes.length} heroes, ${rows.length} abilities, ${rows.filter((row) => row.tag === null).length} untagged.`);
