import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migration = readFileSync(
  new URL('../../migrations/20261104130000_community_tabs_one_player.sql', import.meta.url),
  'utf8',
);

test('the Matches read applies the tab gate to every bucket, not the hero pair gate', () => {
  const reader = migration.slice(migration.indexOf('function public.read_community_matches()'));

  assert.equal(reader.match(/public\.community_tab_bucket_shown\(a\.matches/g)?.length, 3);
  assert.doesNotMatch(reader.slice(0, reader.indexOf('do $$')), /public\.community_bucket_shown\(/);
});

test('the hero pair gate is not redefined', () => {
  assert.doesNotMatch(migration, /create or replace function public\.community_bucket_shown/);
});

test('the tab gate stays closed to the publishable key', () => {
  assert.match(
    migration,
    /revoke execute on function public\.community_tab_bucket_shown\([^)]*\) from public, anon, authenticated/,
  );
});
