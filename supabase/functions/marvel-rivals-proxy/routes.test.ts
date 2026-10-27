import assert from 'node:assert/strict';
import { it } from 'node:test';
import { allowedProviderPath, providerRootUrl } from './routes.ts';

it('allows every route the Angular client calls', () => {
  const clientRoutes = [
    'v1/heroes/hero/spider-man',
    'v1/player/Malibu64',
    'v1/player/123456789/update',
    'v1/player/123456789/match-history',
    'v2/player/123456789/match-history',
    'v1/find-player/Malibu64',
    'v1/match/match-uid-1',
  ];

  for (const route of clientRoutes) {
    assert.equal(allowedProviderPath(route), route, `expected ${route} to be allowed`);
  }
});

it('returns a percent-escaped player name unchanged', () => {
  // A name with a space arrives as the client's encodeURIComponent output.
  assert.equal(allowedProviderPath('v1/player/Silent%20Coder'), 'v1/player/Silent%20Coder');
});

it('refuses anything outside the allow-list', () => {
  const refused = [
    '',
    '/v1/player/Malibu64',           // leading slash: not the shape the function builds
    'v1/heroes',                     // provider endpoint the app never calls
    'v3/player/Malibu64',            // unknown version
    'v2/player/Malibu64',            // v2 is match-history only
    'v1/player/Malibu64/delete',     // unknown sub-resource
    'v1/player/a/b/match-history',   // extra segment
    'v1/match/uid/extra',
    'v1/player/x%2f..%2fheroes',     // encoded slash smuggling a separator
    'v1/player/../heroes/hero/loki', // traversal the URL parser would resolve
    'v1/player/.',
  ];

  for (const route of refused) {
    assert.equal(allowedProviderPath(route), null, `expected ${route} to be refused`);
  }
});

it('trims the version the sibling sync functions put on the shared base URL', () => {
  assert.equal(providerRootUrl('https://marvelrivalsapi.com/api/v1'), 'https://marvelrivalsapi.com/api');
  assert.equal(providerRootUrl('https://marvelrivalsapi.com/api/v2/'), 'https://marvelrivalsapi.com/api');
  assert.equal(providerRootUrl('https://marvelrivalsapi.com/api'), 'https://marvelrivalsapi.com/api');
});

it('falls back to the provider root when the base URL is unset', () => {
  assert.equal(providerRootUrl(undefined), 'https://marvelrivalsapi.com/api');
  assert.equal(providerRootUrl('   '), 'https://marvelrivalsapi.com/api');
});

it('refuses a base URL that is not https', () => {
  assert.throws(() => providerRootUrl('http://marvelrivalsapi.com/api/v1'));
});
