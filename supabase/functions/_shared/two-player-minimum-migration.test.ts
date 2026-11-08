import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../../migrations/20261108120000_two_player_community_minimum.sql', import.meta.url),
  'utf8',
).replace(/--.*$/gm, '');

test('both rules need 2 players and 10 matches, and read the busiest player limit from one function', () => {
  assert.match(migration, /select p_matches >= 10\s+and p_recorders >= 2\s+and p_top_recorder_matches \* 100 <= p_matches \* public\.community_max_recorder_share_percent\(\)/);
  assert.match(migration, /select p_recorders >= 2\s+and p_top_recorder_matches \* 100 <= p_matches \* public\.community_max_recorder_share_percent\(\)/);
  assert.doesNotMatch(migration, /p_recorders >= [3-9]/);
});

test('the limit on the busiest player is one named number, 100 meaning no limit', () => {
  assert.match(migration, /function public\.community_max_recorder_share_percent\(\) returns integer[\s\S]*?as \$\$ select 100 \$\$;/);
});

test('it restates only the two rules and the limit, and keeps them closed to the publishable key', () => {
  assert.deepEqual(
    [...migration.matchAll(/create or replace function (public\.\w+)\(/g)].map((match) => match[1]),
    ['public.community_max_recorder_share_percent', 'public.hero_figure_qualifies', 'public.community_bucket_shown'],
  );

  for (const signature of [
    'community_max_recorder_share_percent\\(\\)',
    'hero_figure_qualifies\\(integer, integer, integer\\)',
    'community_bucket_shown\\(integer, integer, integer\\)',
  ]) {
    assert.match(migration, new RegExp(`revoke execute on function public\\.${signature} from public, anon, authenticated`));
    assert.match(migration, new RegExp(`grant execute on function public\\.${signature} to service_role`));
  }
});

test('its asserts hide one player and show two, however the matches are split', () => {
  assert.match(migration, /assert not public\.hero_figure_qualifies\(10, 1, 5\)/);
  assert.match(migration, /assert public\.hero_figure_qualifies\(10, 2, 6\)/);
  assert.match(migration, /assert not public\.community_bucket_shown\(10, 1, 10\)/);
  assert.match(migration, /assert public\.community_bucket_shown\(10, 2, 6\)/);
});
