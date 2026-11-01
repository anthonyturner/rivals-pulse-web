import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { allowedAvatarUrl, OVERWOLF_AVATAR_DOMAINS, readPlayerClaim, readPlayerProfile } from './player-claim.ts';

describe('allowedAvatarUrl', () => {
  it('keeps an https address on an allowed host', () => {
    assert.equal(allowedAvatarUrl('https://content.overwolf.com/avatars/a.png'), 'https://content.overwolf.com/avatars/a.png');
    assert.equal(allowedAvatarUrl('https://overwolf.com/a.png'), 'https://overwolf.com/a.png');
    assert.equal(allowedAvatarUrl('  https://static.overwolf.com/a.png  '), 'https://static.overwolf.com/a.png');
  });

  it('drops anything that is not https', () => {
    for (const url of ['http://content.overwolf.com/a.png', 'ftp://content.overwolf.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AAAA']) {
      assert.equal(allowedAvatarUrl(url), null, url);
    }
  });

  it('drops a host that is not on the list, including look-alikes', () => {
    for (const url of [
      'https://example.com/a.png',
      'https://cdn.discordapp.com/a.png',
      'https://overwolf.com.evil.example/a.png',
      'https://evil-overwolf.com/a.png',
      'https://content.overwolf.com@evil.example/a.png',
      'https://evil.example/https://content.overwolf.com/a.png',
    ]) {
      assert.equal(allowedAvatarUrl(url), null, url);
    }
  });

  it('drops an address with credentials or a port', () => {
    assert.equal(allowedAvatarUrl('https://user:pass@content.overwolf.com/a.png'), null);
    assert.equal(allowedAvatarUrl('https://content.overwolf.com:8443/a.png'), null);
  });

  it('drops what is not an address at all, or is far too long', () => {
    for (const value of [undefined, null, 42, {}, '', '   ', 'not a url', `https://content.overwolf.com/${'a'.repeat(600)}`]) {
      assert.equal(allowedAvatarUrl(value), null, String(value));
    }
  });

  it('allows only hosts named in the one constant', () => {
    assert.deepEqual(OVERWOLF_AVATAR_DOMAINS, ['overwolf.com']);
  });
});

describe('readPlayerClaim', () => {
  it('reads the uid, the name and an allowed avatar', () => {
    assert.deepEqual(
      readPlayerClaim({ playerUid: '1234567', playerName: ' Aurora ', avatarUrl: 'https://content.overwolf.com/a.png' }),
      { uid: '1234567', name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
    );
  });

  it('reads a numeric uid', () => {
    assert.equal(readPlayerClaim({ playerUid: 1234567, playerName: 'Aurora' })?.uid, '1234567');
  });

  it('keeps the player but not an avatar from a host that is not allowed', () => {
    assert.deepEqual(
      readPlayerClaim({ playerUid: '1', playerName: 'Aurora', avatarUrl: 'https://evil.example/a.png' }),
      { uid: '1', name: 'Aurora', avatarUrl: null },
    );
  });

  it('refuses when the app has no uid or no name yet', () => {
    assert.equal(readPlayerClaim({ playerName: 'Aurora' }), null);
    assert.equal(readPlayerClaim({ playerUid: '1' }), null);
    assert.equal(readPlayerClaim({ playerUid: '  ', playerName: 'Aurora' }), null);
    assert.equal(readPlayerClaim({ playerUid: '1', playerName: '' }), null);
    assert.equal(readPlayerClaim({ playerUid: null, playerName: null }), null);
  });

  it('refuses a body that is not an object', () => {
    for (const body of [null, undefined, 'text', 42, true]) assert.equal(readPlayerClaim(body), null);
  });

  it('strips zero-width and bidi characters that could reorder a name', () => {
    const claim = readPlayerClaim({ playerUid: '1', playerName: 'Au\u200Bro\u202Era\u2066x\u200F' });
    assert.equal(claim?.name, 'Aurorax');
  });

  it('cuts by whole characters, never through a surrogate pair', () => {
    const claim = readPlayerClaim({ playerUid: '1', playerName: '\u{1F600}'.repeat(100) });
    assert.equal(Array.from(claim?.name ?? '').length, 64);
    assert.doesNotMatch(claim?.name ?? '', /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it('strips control characters and caps the lengths', () => {
    const claim = readPlayerClaim({ playerUid: '1\n2', playerName: `Au\u0000ro\u001fra${'x'.repeat(100)}` });
    assert.equal(claim?.uid, '12');
    assert.ok(claim?.name.startsWith('Aurora'));
    assert.equal(claim?.name.length, 64);
  });
});

describe('readPlayerProfile', () => {
  it('reads a cleaned name and an allowed avatar, and needs no uid', () => {
    assert.deepEqual(
      readPlayerProfile({ playerName: ' Au\u200Brora ', avatarUrl: 'https://content.overwolf.com/a.png' }),
      { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
    );
  });

  it('turns an avatar that is not allowed into none, and keeps the name', () => {
    for (const avatarUrl of ['https://evil.example/a.png', 'http://content.overwolf.com/a.png', 7, undefined]) {
      assert.deepEqual(readPlayerProfile({ playerName: 'Aurora', avatarUrl }), { name: 'Aurora', avatarUrl: null });
    }
  });

  it('refuses a body with no usable name', () => {
    for (const body of [null, undefined, 'text', {}, { playerName: '  ' }, { playerName: '\u200B' }, { playerName: 5.5 }]) {
      assert.equal(readPlayerProfile(body), null, String(body));
    }
  });

  it('ignores a uid, so a refresh cannot carry one', () => {
    assert.deepEqual(readPlayerProfile({ playerUid: '9', playerName: 'Aurora' }), { name: 'Aurora', avatarUrl: null });
  });

  it('caps the name by whole characters', () => {
    assert.equal(Array.from(readPlayerProfile({ playerName: '\u{1F600}'.repeat(100) })?.name ?? '').length, 64);
  });
});

describe('the sources that handle invisible characters', () => {
  it('spell them as escapes, so a reviewer can see what the code strips', () => {
    for (const name of ['player-claim.ts', 'player-claim.test.ts']) {
      assert.doesNotMatch(readFileSync(new URL(name, import.meta.url), 'utf8'), /[^\x00-\x7f]/, name);
    }
  });
});
