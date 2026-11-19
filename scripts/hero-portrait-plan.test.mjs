import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planPortraits } from './hero-portrait-plan.mjs';

const gorr = { id: 'gorr-the-god-butcher', name: 'Gorr the God Butcher' };
const hood = { id: 'the-hood', name: 'The Hood' };
const hulk = { id: 'hulk', name: 'Hulk' };

test('proposes nothing for heroes whose portraits are already in the folder', () => {
  const folder = new Set(['gorr-the-god-butcher.png', 'the-hood.png']);
  const plan = planPortraits([gorr, hood], { exists: (name) => folder.has(name) });

  assert.deepEqual(plan.missing, []);
  assert.deepEqual(plan.present, [gorr, hood]);
});

test('proposes only the hero whose portrait is really missing', () => {
  const folder = new Set(['the-hood.png']);
  const plan = planPortraits([gorr, hood], { exists: (name) => folder.has(name) });

  assert.deepEqual(plan.missing, [{ hero: gorr, fileNames: ['gorr-the-god-butcher.png'] }]);
  assert.deepEqual(plan.present, [hood]);
});

test('a hero with aliased ids is proposed for the aliases it lacks', () => {
  const plan = planPortraits([hulk], { exists: (name) => name === 'hulk.png' });

  assert.deepEqual(plan.missing, [{ hero: hulk, fileNames: ['bruce-banner.png'] }]);
});

test('force proposes every file even when it is present', () => {
  const plan = planPortraits([hood], { exists: () => true, force: true });

  assert.deepEqual(plan.missing, [{ hero: hood, fileNames: ['the-hood.png'] }]);
  assert.deepEqual(plan.present, []);
});
