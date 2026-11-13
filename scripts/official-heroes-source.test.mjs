import assert from 'node:assert/strict';
import test from 'node:test';

import { parseHeroCards, parseOfficialHeroArticle, scrapeOfficialHeroes, selectOfficialHeroes } from './official-heroes-source.mjs';

const card = {
  id: '2mpwiwa9ct6hn', name: 'Nightcrawler', slug: 'nightcrawler',
  url: 'https://www.marvelrivals.com/heroes/2mpwiwa9ct6hn/index.html',
  imageUrl: 'https://www.marvelrivals.com/nightcrawler.png',
};

test('a targeted sync selects one canonical hero and refuses unknown or ambiguous identities', () => {
  const heroes = [{ id: 'nightcrawler' }, { id: 'luna-snow' }];
  assert.deepEqual(selectOfficialHeroes(heroes, 'nightcrawler'), [heroes[0]]);
  assert.equal(selectOfficialHeroes(heroes, undefined), heroes);
  assert.throws(() => selectOfficialHeroes(heroes, 'unknown'), /found 0/);
  assert.throws(() => selectOfficialHeroes([heroes[0], heroes[0]], 'nightcrawler'), /found 2/);
});

function currentData() {
  return {
    id: card.id, nickname: 'NIGHTCRAWLER', realName: 'KURT WAGNER', jobs: ['strategist'],
    variants: [{ name: 'NIGHTCRAWLER', jobType: 2, stats: [{ label: 'HEALTH', value: '275', unit: '' }] }],
    skills: [
      { type: 'normal', name: 'FORGED BRIMSTONE', description: 'Grenades heal allies and damage enemies.', key: 'mouse-left', stats: [{ label: 'HEALING', value: '30', unit: 'HP' }], variantIndex: 0 },
      { type: 'ability', name: 'PHASING FINALE', description: 'Teleport nearby allies to a selected destination.', key: 'Q', stats: [], variantIndex: 0 },
      { type: 'ability', name: 'CRAWLER CLING', description: 'Climb vertical surfaces.', key: 'passive', stats: [], variantIndex: 0 },
      { type: 'unused', name: 'OLD TEAMUP', description: 'Not currently active.', key: 'C', stats: [], variantIndex: 0 },
    ],
    teamups: [{ name: 'PROTECTIVE SIBLINGS', key: 'C', tiers: [
      { name: 'PROTECTIVE SIBLINGS', description: 'Damage enemies and heal allies.', stats: [{ label: 'HEALING', value: '50', unit: '' }], tier: 'base' },
      { name: 'PROTECTIVE SIBLINGS', description: 'Damage enemies and heal allies.', stats: [{ label: 'HEALING', value: '30', unit: '' }], tier: 'enhanced' },
    ] }],
  };
}

function currentHtml(data = currentData()) {
  return `<script>\n// Structured hero kit supplied by the official site.\nwindow.__HERO_DATA__ = ${JSON.stringify(data)};</script>
    <div class="hero-career"><span>STRATEGIST</span></div>
    <div class="hero-lore"><p>Kurt keeps hope alive.</p></div>`;
}

test('current hero anchors resolve relative URLs and ignore unrelated links', () => {
  const cards = parseHeroCards(`<a href="./2mpwiwa9ct6hn/index.html" data-id="2mpwiwa9ct6hn" data-name="NIGHTCRAWLER" title="NIGHTCRAWLER"><img src="/nightcrawler.png"></a>
    <a href="/news" title="News">News</a>`);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].name, 'Nightcrawler');
  assert.equal(cards[0].url, card.url);
  assert.equal(cards[0].imageUrl, card.imageUrl);
  assert.equal(cards[0].role, undefined);
});

test('legacy data-url hero cards remain supported', () => {
  const cards = parseHeroCards('<a data-url="/heroes/luna/index.html" data-name="LUNA SNOW" data-tag="Strategist"><img src="//www.marvelrivals.com/luna.png"></a>');
  assert.equal(cards[0].role, 'Strategist');
  assert.equal(cards[0].url, 'https://www.marvelrivals.com/heroes/luna/index.html');
});

test('empty or unrelated index fails before any article sync can run', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response('<a href="/news" title="News">News</a>'); };
  try {
    await assert.rejects(scrapeOfficialHeroes(), /no hero/i);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('current structured kit keeps Strategist identity, stats, ability types and teamup tiers', () => {
  const hero = parseOfficialHeroArticle(card, currentHtml());
  assert.equal(hero.name, 'Nightcrawler');
  assert.equal(hero.role, 'Strategist');
  assert.equal(hero.subtitle, 'Kurt Wagner');
  assert.equal(hero.lore, 'Kurt keeps hope alive.');
  assert.deepEqual(hero.baseStats, [{ label: 'Health', value: '275' }]);
  assert.equal(hero.baseStatKits[0].role, 'Strategist');
  assert.deepEqual(hero.abilities.map((ability) => ability.type), ['Normal Attack', 'Ultimate', 'Passive', 'Team-Up Ability']);
  assert.equal(hero.abilities[0].source, 'official');
  assert.ok(hero.abilities[0].technicalDetails.some((detail) => detail.label === 'Healing' && detail.value === '30 HP'));
  const teamup = hero.abilities.at(-1);
  assert.ok(teamup.technicalDetails.some((detail) => detail.value === '50'));
  assert.ok(teamup.technicalDetails.some((detail) => detail.value === '30'));
});

test('multiple jobs remain Multi-Role and preserve separate role kits', () => {
  const data = currentData();
  data.jobs = ['vanguard', 'duelist', 'strategist'];
  data.variants = [0, 1, 2].map((jobType) => ({ name: 'DEADPOOL', jobType, stats: [{ label: 'HEALTH', value: String(500 - jobType * 100), unit: '' }] }));
  const hero = parseOfficialHeroArticle(card, currentHtml(data));
  assert.equal(hero.role, 'Multi-Role');
  assert.deepEqual(hero.baseStatKits.map((kit) => kit.role), ['Vanguard', 'Duelist', 'Strategist']);
});

test('malformed, unknown-role and empty structured kits fail instead of defaulting to Duelist', () => {
  assert.throws(() => parseOfficialHeroArticle(card, '<script>window.__HERO_DATA__ = {bad};</script>'), /official hero/i);
  for (const change of [
    { jobs: ['healer'] }, { variants: [] }, { skills: [] },
    { skills: [{ name: 'Invalid', type: 'ability', key: 'E', stats: [] }] },
    { variants: [{ name: 'Unknown', jobType: 8, stats: [] }] },
  ]) {
    assert.throws(() => parseOfficialHeroArticle(card, currentHtml({ ...currentData(), ...change })), /official hero/i);
  }
});

test('missing or incomplete legacy content cannot overwrite a hero with a default role', () => {
  for (const html of ['', '<html><h1>Temporarily unavailable</h1></html>',
    '<div class="art-inner-content"><p class="p3">STRATEGIST</p></div>']) {
    assert.throws(() => parseOfficialHeroArticle(card, html), /official hero/i);
  }
});

test('legacy table-based hero articles retain ability parsing', () => {
  const html = `<div class="art-inner-content"><p class="p1">LUNA SNOW</p><p class="p3">STRATEGIST</p>
    <table class="table-imgs"><tr><td>0</td><td>Luna Snow</td><td></td><td><table><tr><td>HEALTH</td><td>275</td></tr></table></td><td>2</td></tr>
    <tr><td>1</td><td>LIGHT &amp; DARK ICE</td><td></td><td>Heal allies and damage enemies.</td><td><table><tr><td>KEY</td><td>mouse-left</td></tr></table></td></tr></table></div>`;
  const hero = parseOfficialHeroArticle({ ...card, name: 'Luna Snow' }, html);
  assert.equal(hero.name, 'Luna Snow');
  assert.equal(hero.role, 'Strategist');
  assert.equal(hero.abilities[0].type, 'Normal Attack');
  const [unknownRoleCard] = parseHeroCards('<a href="/heroes/luna/index.html" data-name="LUNA SNOW">Luna</a>');
  assert.throws(() => parseOfficialHeroArticle(unknownRoleCard, html.replace('<p class="p3">STRATEGIST</p>', '')), /official hero/i);
  assert.equal(parseOfficialHeroArticle(card, html.replace('STRATEGIST', 'Multi-Role')).role, 'Multi-Role');
});
