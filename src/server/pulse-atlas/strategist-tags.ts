import { STRATEGIST_TAGS } from '../../contracts/strategist-tags.model.ts';

const ENTRY_KEYS: readonly string[] = ['heroId', 'tag'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The slugs of the heroes that can play the Strategist role: those whose role is Strategist, and a
 * hero the game splits by role (Deadpool) with a Strategist form. `gameIdEntries` is the content of
 * `hero-game-ids.json`; a hero without a role (a malformed row) is not one.
 */
function strategistSlugs(heroes: readonly unknown[], gameIdEntries: unknown): Set<string> {
  const withStrategistForm = new Set<string>();

  for (const entry of Array.isArray(gameIdEntries) ? gameIdEntries : []) {
    const variants = isRecord(entry) && Array.isArray(entry['gameIdVariants']) ? entry['gameIdVariants'] : [];

    if (variants.some((variant) => isRecord(variant) && variant['role'] === 'Strategist')) {
      withStrategistForm.add(String(entry['id']));
    }
  }

  return new Set(
    heroes.flatMap((hero) =>
      isRecord(hero) && (hero['role'] === 'Strategist' || withStrategistForm.has(String(hero['id'])))
        ? [String(hero['id'])]
        : [],
    ),
  );
}

/**
 * Everything wrong with the Strategist tag list; a build must not publish while any remains.
 *
 * The list is empty; an entry has no heroId, a tag other than healer or utility, or a key other than
 * heroId and tag; a hero is listed twice; and, given `heroes`, a hero who can play Strategist has no
 * entry (every Strategist needs exactly one tag, or a trio could not be named) or a hero who cannot
 * has one. An entry for a hero that is not in `heroes` is ignored: a removed hero must not freeze the
 * feed, and readers join the entry to `heroes.json` by slug.
 */
export function findStrategistTagProblems(
  entries: unknown,
  heroes?: readonly unknown[],
  gameIdEntries?: unknown,
): string[] {
  if (!Array.isArray(entries) || entries.length === 0) {
    return ['expected a non-empty list'];
  }

  const errors: string[] = [];
  const tagged = new Set<string>();
  const heroIds = heroes === undefined ? undefined : new Set(heroes.flatMap((hero) => (isRecord(hero) ? [String(hero['id'])] : [])));
  const strategists = heroes === undefined ? undefined : strategistSlugs(heroes, gameIdEntries);

  entries.forEach((entry, index) => {
    if (!isRecord(entry) || !isNonEmptyString(entry['heroId'])) {
      errors.push(`entry ${index} needs a non-empty string heroId`);
      return;
    }

    const heroId = entry['heroId'];

    if (tagged.has(heroId)) {
      errors.push(`${heroId}: listed more than once`);
    }
    tagged.add(heroId);

    const stray = Object.keys(entry).filter((key) => !ENTRY_KEYS.includes(key));

    if (stray.length > 0) {
      errors.push(`${heroId}: unknown key ${stray.join(', ')}; an entry holds only ${ENTRY_KEYS.join(', ')}`);
    }

    if (!STRATEGIST_TAGS.some((tag) => tag === entry['tag'])) {
      errors.push(`${heroId}: tag must be ${STRATEGIST_TAGS.join(' or ')}`);
    }

    if (heroIds?.has(heroId) && strategists?.has(heroId) === false) {
      errors.push(`${heroId}: is not a Strategist, so it must not have a tag`);
    }
  });

  for (const slug of strategists ?? []) {
    if (!tagged.has(slug)) {
      errors.push(`${slug}: a Strategist needs exactly one entry in strategist-tags.json`);
    }
  }

  return errors;
}
