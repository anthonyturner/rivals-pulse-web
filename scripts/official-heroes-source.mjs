const officialHeroesUrl = 'https://www.marvelrivals.com/heroes/index.html';
const officialHomeUrl = 'https://www.marvelrivals.com/index.html';

export async function scrapeOfficialHeroes() {
  const indexHtml = await fetchText(officialHeroesUrl);
  const heroCards = parseHeroCards(indexHtml);
  if (heroCards.length === 0) {
    throw new Error('Official hero index contains no hero cards.');
  }
  // The hero index no longer ships portraits, so they are read from the hero
  // list on the official home page, which still carries one per hero.
  const portraits = heroCards.some((card) => !card.imageUrl)
    ? parseHeroPortraits(await fetchText(officialHomeUrl))
    : new Map();
  const heroes = [];

  for (const card of heroCards) {
    const articleHtml = await fetchText(card.url);
    heroes.push(parseOfficialHeroArticle(
      { ...card, imageUrl: card.imageUrl || portraits.get(card.slug) || '' },
      articleHtml,
    ));
  }

  return {
    sourceUrl: officialHeroesUrl,
    fetchedAt: new Date().toISOString(),
    heroes,
  };
}

export function parseHeroCards(html) {
  const cards = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const attrs = parseAttributes(match[1]);
    const name = cleanText(attrs['data-name'] || attrs.title);
    const href = attrs['data-url'] || attrs.href;
    const url = href ? new URL(href, officialHeroesUrl) : undefined;

    if (!name || !url || url.origin !== new URL(officialHeroesUrl).origin || !/^\/heroes\/[^/]+\/index\.html$/.test(url.pathname)) {
      continue;
    }

    cards.push({
      id: attrs['data-id'],
      name: titleCaseName(name),
      role: normalizeRole(attrs['data-tag']),
      url: url.href,
      slug: slugify(name),
      imageUrl: firstImage(match[2]),
    });
  }

  return uniqueBy(cards, (card) => card.id || card.slug);
}

export function selectOfficialHeroes(heroes, heroId) {
  if (heroId === undefined) return heroes;
  const selected = heroes.filter((hero) => hero.id === heroId);
  if (selected.length !== 1) {
    throw new Error(`Expected one official hero for ${heroId}; found ${selected.length}.`);
  }
  return selected;
}

export function parseHeroPortraits(html) {
  const portraits = new Map();
  const anchorPattern = /<a\b([^>]*\bdata-name="[^"]+"[^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const attrs = parseAttributes(match[1]);
    const slug = slugify(attrs['data-name'] ?? '');
    const imageUrl = firstImage(match[2]);

    if (slug && imageUrl && !portraits.has(slug)) {
      portraits.set(slug, imageUrl);
    }
  }

  return portraits;
}

export function parseOfficialHeroArticle(card, html) {
  if (html.includes('window.__HERO_DATA__')) {
    return parseStructuredHeroArticle(card, html);
  }
  const content = extractByClass(html, 'art-inner-content') || html;
  const table = extractByClass(content, 'table-imgs');
  const rows = table ? extractElements(table, 'tr') : [];
  const baseStats = [];
  const baseStatKits = [];
  const abilities = [];

  for (const row of rows) {
    const cells = extractElements(row, 'td');
    const rowType = Number.parseInt(cleanText(cells[0]), 10);

    if (!Number.isFinite(rowType) || cells.length < 4) {
      continue;
    }

    if (rowType === 0) {
      const stats = parseStatRows(cells[3]);
      const role = roleFromIndex(Number.parseInt(cleanText(cells.at(-1)), 10));

      baseStats.push(...stats);
      baseStatKits.push({
        role,
        label: cleanText(cells[1]) || role,
        stats,
      });
      continue;
    }

    if (rowType > 4) {
      continue;
    }

    const name = cleanText(cells[1]);
    const description = cleanText(cells[3]);

    if (!name || /[\u4e00-\u9fff]/.test(name) || !description) {
      continue;
    }

    const technicalDetails = parseStatRows(cells[4]);
    abilities.push({
      name,
      type: officialAbilityType(rowType, technicalDetails),
      description,
      technicalDetails,
      iconUrl: firstImage(cells[2]),
      source: 'official',
    });
  }

  const rawRole = cleanText(extractByClass(content, 'p3')) || card.role;
  if (!/^(vanguard|duelist|strategist|multi-role)$/i.test(rawRole ?? '') ||
      baseStats.length === 0 || abilities.length === 0) {
    throw new Error(`Invalid official hero kit for ${card.name}.`);
  }

  return {
    id: slugify(card.name),
    officialId: card.id,
    name: titleCaseName(cleanText(extractByClass(content, 'p1')) || card.name),
    subtitle: cleanText(extractByClass(content, 'p2')),
    role: normalizeRole(rawRole),
    summary: cleanText(extractByClass(content, 'p4')),
    lore: cleanText(extractByClass(content, 'd1')),
    sourceUrl: card.url,
    listImageUrl: card.imageUrl,
    articleImageUrls: allImages(html),
    baseStats: uniqueStats(baseStats),
    baseStatKits: compactBaseStatKits(baseStatKits),
    abilities: mergeDuplicateOfficialAbilities(abilities),
  };
}

function parseStructuredHeroArticle(card, html) {
  const script = html.match(/window\.__HERO_DATA__\s*=\s*([\s\S]*?)<\/script>/i);
  let data;
  try {
    data = JSON.parse(script?.[1].trim().replace(/;\s*$/, '') ?? '');
  } catch {
    throw new Error(`Invalid official hero JSON for ${card.name}.`);
  }

  const fail = () => { throw new Error(`Invalid official hero kit for ${card.name}.`); };
  if (!isRecord(data) || !nonemptyString(data.nickname) || !Array.isArray(data.jobs) || data.jobs.length === 0 ||
      !Array.isArray(data.variants) || data.variants.length === 0 || !Array.isArray(data.skills) ||
      !Array.isArray(data.teamups)) {
    fail();
  }
  const roles = [...new Set(data.jobs.map((job) => {
    if (!nonemptyString(job) || !/^(vanguard|duelist|strategist)$/i.test(job)) fail();
    return normalizeRole(job);
  }))];
  const baseStatKits = data.variants.map((variant) => {
    if (!isRecord(variant) || !nonemptyString(variant.name) || !Number.isInteger(variant.jobType) ||
        !roleFromIndex(variant.jobType)) fail();
    const stats = structuredStats(variant.stats, fail);
    if (stats.length === 0) fail();
    return { role: roleFromIndex(variant.jobType), label: titleCaseName(variant.name), stats };
  });
  const abilities = [];
  for (const skill of data.skills) {
    if (!isRecord(skill) || !nonemptyString(skill.type)) fail();
    if (skill.type === 'unused') continue;
    if (!['normal', 'ability'].includes(skill.type) || !nonemptyString(skill.name) ||
        !nonemptyString(skill.description) || !nonemptyString(skill.key)) fail();
    const technicalDetails = [
      { label: 'Key', value: skill.key },
      ...structuredStats(skill.stats, fail),
    ];
    abilities.push({
      name: cleanText(skill.name),
      type: officialAbilityType(skill.type === 'normal' ? 1 : 2, technicalDetails),
      description: cleanText(skill.description),
      technicalDetails,
      iconUrl: nonemptyString(skill.icon) ? absoluteUrl(skill.icon) : '',
      source: 'official',
    });
  }
  if (abilities.length === 0) fail();
  for (const teamup of data.teamups) {
    if (!isRecord(teamup) || !nonemptyString(teamup.name) || !Array.isArray(teamup.tiers) || teamup.tiers.length === 0) fail();
    for (const tier of teamup.tiers) {
      if (!isRecord(tier) || !nonemptyString(tier.description)) fail();
      abilities.push({
        name: cleanText(teamup.name),
        type: 'Team-Up Ability',
        description: cleanText(tier.description),
        technicalDetails: [
          ...(nonemptyString(teamup.key) ? [{ label: 'Key', value: teamup.key }] : []),
          ...structuredStats(tier.stats, fail),
        ],
        iconUrl: nonemptyString(tier.icon) ? absoluteUrl(tier.icon) : '',
        source: 'official',
      });
    }
  }

  return {
    id: slugify(data.nickname),
    officialId: card.id,
    name: titleCaseName(data.nickname),
    subtitle: nonemptyString(data.realName) ? titleCaseName(data.realName) : '',
    role: roles.length > 1 ? 'Multi-Role' : roles[0],
    summary: cleanText(extractByClass(html, 'hero-desc')),
    lore: cleanText(extractByClass(html, 'hero-lore')),
    sourceUrl: card.url,
    listImageUrl: card.imageUrl,
    articleImageUrls: allImages(html),
    baseStats: uniqueStats(baseStatKits.flatMap((kit) => kit.stats)),
    baseStatKits: compactBaseStatKits(baseStatKits),
    abilities: mergeDuplicateOfficialAbilities(abilities),
  };
}

function structuredStats(stats, fail) {
  if (!Array.isArray(stats)) fail();
  return stats.map((stat) => {
    if (!isRecord(stat) || !nonemptyString(stat.label) ||
        (typeof stat.value !== 'string' && typeof stat.value !== 'number') ||
        (stat.unit !== undefined && typeof stat.unit !== 'string')) fail();
    return {
      label: toTitleCase(cleanText(stat.label)),
      value: cleanText(`${stat.value}${stat.unit ? ` ${stat.unit}` : ''}`),
    };
  });
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonemptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function stableOfficialPayload(payload) {
  return {
    sourceUrl: payload.sourceUrl,
    heroes: payload.heroes.map((hero) => ({
      id: hero.id,
      officialId: hero.officialId,
      name: hero.name,
      role: hero.role,
      summary: hero.summary,
      lore: hero.lore,
      baseStats: hero.baseStats,
      baseStatKits: hero.baseStatKits,
      abilities: hero.abilities.map((ability) => ({
        name: ability.name,
        type: ability.type,
        description: ability.description,
        technicalDetails: ability.technicalDetails,
      })),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
}

export function diffOfficialPayloads(previousPayload, nextPayload) {
  const previousHeroes = new Map((previousPayload?.heroes ?? []).map((hero) => [hero.id, hero]));
  const nextHeroes = new Map(nextPayload.heroes.map((hero) => [hero.id, hero]));
  const added = [];
  const removed = [];
  const changed = [];

  for (const [heroId, hero] of nextHeroes) {
    if (!previousHeroes.has(heroId)) {
      added.push(hero.name);
      continue;
    }

    if (stableHero(hero) !== stableHero(previousHeroes.get(heroId))) {
      changed.push(hero.name);
    }
  }

  for (const [heroId, hero] of previousHeroes) {
    if (!nextHeroes.has(heroId)) {
      removed.push(hero.name);
    }
  }

  return { added, changed, removed };
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'rivals-pulse-official-hero-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }

  return response.text();
}

function mergeDuplicateOfficialAbilities(abilities) {
  const merged = [];

  for (const ability of abilities) {
    const existing = merged.find((item) =>
      item.name.toLowerCase() === ability.name.toLowerCase() &&
      item.type === ability.type &&
      item.description === ability.description,
    );

    if (!existing) {
      merged.push(ability);
      continue;
    }

    const prefix = existing.technicalDetails.length > 0 ? 'Enhanced ' : '';
    for (const detail of ability.technicalDetails) {
      const label = existing.technicalDetails.some((item) => item.label === detail.label && item.value !== detail.value)
        ? `${prefix}${detail.label}`
        : detail.label;

      if (!existing.technicalDetails.some((item) => item.label === label && item.value === detail.value)) {
        existing.technicalDetails.push({ label, value: detail.value });
      }
    }
  }

  return merged;
}

function officialAbilityType(rowType, details) {
  const key = details.find((detail) => detail.label.toLowerCase() === 'key')?.value ?? '';

  if (rowType === 1) {
    return 'Normal Attack';
  }

  if (rowType === 3 || rowType === 4) {
    return 'Team-Up Ability';
  }

  if (/passive/i.test(key)) {
    return 'Passive';
  }

  if (/^q$|l3\s*\+\s*r3/i.test(key)) {
    return 'Ultimate';
  }

  return 'Ability';
}

function compactBaseStatKits(baseStatKits) {
  const seen = new Set();
  const compact = [];

  for (const kit of baseStatKits) {
    const key = `${kit.role}:${JSON.stringify(kit.stats)}`;

    if (seen.has(key) || kit.stats.length === 0) {
      continue;
    }

    seen.add(key);
    compact.push(kit);
  }

  return compact;
}

function uniqueStats(stats) {
  const seen = new Set();
  const unique = [];

  for (const stat of stats) {
    const key = `${stat.label}:${stat.value}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(stat);
  }

  return unique;
}

function roleFromIndex(index) {
  return ['Vanguard', 'Duelist', 'Strategist'][index] ?? undefined;
}

function parseStatRows(html = '') {
  return extractElements(html, 'tr')
    .map((row) => extractElements(row, 'td'))
    .map((cells) => ({
      label: toTitleCase(cleanText(cells[0])),
      value: cleanText(cells[1]),
    }))
    .filter((detail) => detail.label && detail.value && detail.value !== '&nbsp;');
}

function extractByClass(html, className) {
  const match = html.match(new RegExp(`<([a-z0-9]+)\\b[^>]*class="[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*>`, 'i'));

  return match ? extractElementAt(html, match.index, match[1]) : '';
}

function extractElements(html, tagName) {
  const elements = [];
  const openPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;

  while ((match = openPattern.exec(html))) {
    const element = extractElementAt(html, match.index, tagName);

    if (element) {
      elements.push(element);
      openPattern.lastIndex = match.index + element.length;
    }
  }

  return elements;
}

function extractElementAt(html, startIndex, tagName) {
  const tagPattern = new RegExp(`</?${tagName}\\b[^>]*>`, 'gi');
  tagPattern.lastIndex = startIndex;
  let depth = 0;
  let match;

  while ((match = tagPattern.exec(html))) {
    const isClosing = match[0].startsWith('</');
    depth += isClosing ? -1 : 1;

    if (depth === 0) {
      return html.slice(startIndex, tagPattern.lastIndex);
    }
  }

  return '';
}

function parseAttributes(value) {
  const attrs = {};
  const attrPattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match;

  while ((match = attrPattern.exec(value))) {
    attrs[match[1]] = decodeHtml(match[2]);
  }

  return attrs;
}

function firstImage(html = '') {
  const match = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i);

  return match ? absoluteUrl(decodeHtml(match[1])) : '';
}

function allImages(html = '') {
  const urls = [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map((match) => absoluteUrl(decodeHtml(match[1])))
    .filter(Boolean);

  return [...new Set(urls)];
}

function absoluteUrl(value = '') {
  if (!value) {
    return '';
  }

  if (value.startsWith('//')) {
    return `https:${value}`;
  }

  if (value.startsWith('/')) {
    return `https://www.marvelrivals.com${value}`;
  }

  return value;
}

function cleanText(value = '') {
  return decodeHtml(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value = '') {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeRole(value = '') {
  const normalized = cleanText(value).toUpperCase();

  if (normalized.includes('VANGUARD')) {
    return 'Vanguard';
  }

  if (normalized.includes('STRATEGIST')) {
    return 'Strategist';
  }

  if (normalized.includes('DUELIST')) {
    return 'Duelist';
  }

  return 'Duelist';
}

function titleCaseName(value = '') {
  const specialCases = new Map([
    ['CLOAK&DAGGER', 'Cloak & Dagger'],
    ['CLOAK AND DAGGER', 'Cloak & Dagger'],
    ['PENI PARKER', 'Peni Parker'],
  ]);
  const normalized = cleanText(value).toUpperCase();

  if (specialCases.has(normalized)) {
    return specialCases.get(normalized);
  }

  return normalized
    .toLowerCase()
    .split(/(\s+|-|&)/)
    .map((part) => /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part)
    .join('')
    .replace(/\bAi\b/g, 'AI');
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toTitleCase(value) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = getKey(item);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  return unique;
}

// Stored payloads come back from a jsonb column, which does not keep key order, so the
// comparison must not depend on it.
function stableHero(hero) {
  return canonicalJson({
    name: hero.name,
    role: hero.role,
    summary: hero.summary,
    lore: hero.lore,
    baseStats: hero.baseStats,
    baseStatKits: hero.baseStatKits,
    abilities: hero.abilities.map((ability) => ({
      name: ability.name,
      type: ability.type,
      description: ability.description,
      technicalDetails: ability.technicalDetails,
    })),
  });
}

function canonicalJson(value) {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)))
      : item,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
