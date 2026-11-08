import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compareHeroGameRoles, type HeroGameRoleRow } from './hero-game-roles-compare.ts';

const ENTRIES = [
  { id: 'hulk', gameId: 1011 },
  { id: 'loki', gameId: 1016 },
  {
    id: 'deadpool',
    gameId: 1057,
    gameIdVariants: [
      { gameId: 10571, role: 'Vanguard' },
      { gameId: 10572, role: 'Duelist' },
      { gameId: 10573, role: 'Strategist' },
    ],
  },
];
const LIVE = new Map([
  ['hulk', 'Vanguard'],
  ['loki', 'Strategist'],
  ['deadpool', 'Vanguard'],
]);
const ROWS: HeroGameRoleRow[] = [
  { gameId: 1011, baseGameId: 1011, role: 'Vanguard' },
  { gameId: 1016, baseGameId: 1016, role: 'Strategist' },
  { gameId: 10571, baseGameId: 1057, role: 'Vanguard' },
  { gameId: 10572, baseGameId: 1057, role: 'Duelist' },
  { gameId: 10573, baseGameId: 1057, role: 'Strategist' },
];

describe('compareHeroGameRoles', () => {
  it('finds nothing wrong when the table matches the live hero list, whatever role the list gives Deadpool himself', () => {
    assert.deepEqual(compareHeroGameRoles(ROWS, ENTRIES, LIVE), []);
    assert.deepEqual(compareHeroGameRoles(ROWS, ENTRIES, new Map([...LIVE, ['deadpool', 'Multi-Role']])), []);
  });

  it('reports a Vanguard or Duelist the table has as another role', () => {
    const rows = ROWS.map((row) => (row.gameId === 1011 ? { ...row, role: 'Duelist' } : row));

    assert.deepEqual(compareHeroGameRoles(rows, ENTRIES, LIVE), [
      'hulk (1011): hero_game_roles says Duelist, the live hero list says Vanguard',
    ]);
  });

  it('reports a hero with no row, and a row for no hero', () => {
    const rows = [...ROWS.filter((row) => row.gameId !== 1016), { gameId: 1999, baseGameId: 1999, role: 'Duelist' }];

    assert.deepEqual(compareHeroGameRoles(rows, ENTRIES, LIVE), [
      'loki (1016): no row in hero_game_roles, expected Strategist',
      '1999: a row in hero_game_roles that no hero in hero-game-ids.json has',
    ]);
  });

  it('reports a hero in the live list that has no game id yet, and a hero the list gives no role', () => {
    const live = new Map([...LIVE, ['newcomer', 'Duelist']]);
    live.delete('hulk');

    assert.deepEqual(compareHeroGameRoles(ROWS, ENTRIES, live), [
      'hulk (1011): the live hero list has no Vanguard, Duelist or Strategist role for it',
      'newcomer: in the live hero list, but has no game id in hero-game-ids.json',
    ]);
  });

  it('reports a wrong base id', () => {
    const rows = ROWS.map((row) => (row.gameId === 10573 ? { ...row, baseGameId: 1058 } : row));

    assert.deepEqual(compareHeroGameRoles(rows, ENTRIES, LIVE), [
      'deadpool (10573): base id is 1058 in hero_game_roles, 1057 in hero-game-ids.json',
    ]);
  });
});
