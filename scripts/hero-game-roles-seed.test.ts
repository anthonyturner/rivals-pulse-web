import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MIGRATIONS, read } from '../supabase/functions/track-match-history/migration-sql.ts';
import heroGameIds from '../data/pulse-atlas/hero-game-ids.json' with { type: 'json' };
import strategistTags from '../data/pulse-atlas/strategist-tags.json' with { type: 'json' };

/**
 * `public.hero_game_roles` is how the database knows which game hero ids are Strategists, and it is
 * seeded by migrations, so it can drift from the hero data the website and Pulse Atlas read. This
 * reads the rows every migration inserts (a later row for the same id wins, as `on conflict ... do
 * update` makes it) and compares them with `hero-game-ids.json` and `strategist-tags.json`. The
 * non-Strategist roles cannot be checked here: the hero list that holds them lives in the database.
 */
const ROW = /^\s*\((\d+),\s*(\d+),\s*'(Vanguard|Duelist|Strategist)'\)/gm;

interface RoleRow {
  baseGameId: number;
  role: string;
}

type HeroGameIds = (typeof heroGameIds)[number];

/** The role-specific game ids of a hero the game splits by role, and none for any other hero. */
function variantsOf(entry: HeroGameIds): { gameId: number; role: string }[] {
  return 'gameIdVariants' in entry ? (entry.gameIdVariants ?? []) : [];
}

/** Every game id the hero answers to: its role forms when it has them, otherwise its own id. */
function gameIdsOf(entry: HeroGameIds): number[] {
  const variants = variantsOf(entry);

  return variants.length > 0 ? variants.map((variant) => variant.gameId) : [entry.gameId];
}

function seededRoles(): Map<number, RoleRow> {
  const roles = new Map<number, RoleRow>();

  for (const name of readdirSync(MIGRATIONS).filter((file) => file.endsWith('.sql')).sort()) {
    for (const insert of read(name).split(/insert\s+into\s+public\.hero_game_roles/i).slice(1)) {
      const block = insert.slice(0, insert.search(/;/));

      for (const [, gameId, baseGameId, role] of block.matchAll(ROW)) {
        roles.set(Number(gameId), { baseGameId: Number(baseGameId), role });
      }
    }
  }

  return roles;
}

describe('hero_game_roles as the migrations seed it', () => {
  const roles = seededRoles();

  it('has a row for every game hero id in hero-game-ids.json, under the right base id', () => {
    for (const entry of heroGameIds) {
      for (const gameId of gameIdsOf(entry)) {
        assert.equal(roles.get(gameId)?.baseGameId, entry.gameId, `${entry.id} ${gameId}`);
      }
    }
  });

  it('has no row for a base id the game splits by role, or for any id that belongs to no hero', () => {
    const known = new Set(heroGameIds.flatMap(gameIdsOf));

    assert.deepEqual([...roles.keys()].filter((gameId) => !known.has(gameId)), []);
  });

  it('gives a role form of a split hero the role the data says it has', () => {
    for (const entry of heroGameIds) {
      for (const variant of variantsOf(entry)) {
        assert.equal(roles.get(variant.gameId)?.role, variant.role, `${entry.id} ${variant.gameId}`);
      }
    }
  });

  it('marks as Strategist exactly the game ids of the heroes strategist-tags.json tags', () => {
    const tagged = new Set(strategistTags.map((entry) => entry.heroId));
    const expected = heroGameIds
      .filter((entry) => tagged.has(entry.id))
      .flatMap((entry) =>
        variantsOf(entry).length > 0
          ? variantsOf(entry).filter((variant) => variant.role === 'Strategist').map((variant) => variant.gameId)
          : [entry.gameId],
      );
    const seeded = [...roles].filter(([, row]) => row.role === 'Strategist').map(([gameId]) => gameId);

    assert.deepEqual(seeded.sort(), expected.sort());
  });
});
