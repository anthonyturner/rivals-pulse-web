const officialHeroesUrl = 'https://www.marvelrivals.com/heroes/index.html';

export async function scrapeOfficialHeroes() {
  const indexHtml = await fetchText(officialHeroesUrl);
  const heroCards = parseHeroCards(indexHtml);
  const heroes = [];

  for (const card of heroCards) {
    const articleHtml = await fetchText(card.url);
    heroes.push(parseOfficialHeroArticle(card, articleHtml));
  }

  return {
    sourceUrl: officialHeroesUrl,
    fetchedAt: new Date().toISOString(),
    heroes,
  };
}

export function parseHeroCards(html) {
  const cards = [];
  const anchorPattern = /<a\b([^>]*\bdata-url="[^"]+"[^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const attrs = parseAttributes(match[1]);
    const name = cleanText(attrs['data-name'] || attrs.title);
    const url = absoluteUrl(attrs['data-url']);

    if (!name || !url) {
      continue;
    }

    cards.push({
      id: attrs['data-id'],
      name: titleCaseName(name),
      role: normalizeRole(attrs['data-tag']),
      url,
      slug: slugify(name),
      imageUrl: firstImage(match[2]),
    });
  }

  return uniqueBy(cards, (card) => card.id || card.slug);
}

export function parseOfficialHeroArticle(card, html) {
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

  return {
    id: slugify(card.name),
    officialId: card.id,
    name: titleCaseName(cleanText(extractByClass(content, 'p1')) || card.name),
    subtitle: cleanText(extractByClass(content, 'p2')),
    role: normalizeRole(cleanText(extractByClass(content, 'p3')) || card.role),
    summary: cleanText(extractByClass(content, 'p4')),
    lore: cleanText(extractByClass(content, 'd1')),
    sourceUrl: card.url,
    listImageUrl: card.imageUrl,
    baseStats: uniqueStats(baseStats),
    baseStatKits: compactBaseStatKits(baseStatKits),
    abilities: mergeDuplicateOfficialAbilities(abilities),
  };
}

export function stableOfficialPayload(payload) {
  return JSON.stringify({
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
  }, null, 2);
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

function stableHero(hero) {
  return JSON.stringify({
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
