import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeLinkCode } from '../../../src/link-code.ts';
import { formatLinkCode, generateLinkCode, LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from './link-code.ts';

const bytesOf = (...values: number[]) => (bytes: Uint8Array): Uint8Array => {
  bytes.set(values);
  return bytes;
};

describe('LINK_CODE_ALPHABET', () => {
  it('is Crockford base32: 32 distinct characters without I, L, O and U', () => {
    assert.equal(LINK_CODE_ALPHABET.length, 32);
    assert.equal(new Set(LINK_CODE_ALPHABET).size, 32);
    for (const letter of 'ILOU') assert.ok(!LINK_CODE_ALPHABET.includes(letter), letter);
    assert.match(LINK_CODE_ALPHABET, /^[0-9A-Z]+$/);
  });
});

describe('generateLinkCode', () => {
  it('makes eight characters from the alphabet', () => {
    for (let run = 0; run < 200; run++) {
      const code = generateLinkCode();
      assert.equal(code.length, LINK_CODE_LENGTH);
      assert.match(code, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    }
  });

  it('turns every byte into a letter with the same likelihood', () => {
    const seen = new Map<string, number>();
    for (let byte = 0; byte < 256; byte++) {
      const letter = generateLinkCode(bytesOf(byte, byte, byte, byte, byte, byte, byte, byte))[0];
      seen.set(letter, (seen.get(letter) ?? 0) + 1);
    }
    assert.equal(seen.size, 32);
    assert.deepEqual([...new Set(seen.values())], [8]);
  });

  it('reads the random bytes it is given, so a fixed source gives a fixed code', () => {
    assert.equal(generateLinkCode(bytesOf(0, 1, 2, 3, 4, 5, 6, 7)), '01234567');
    assert.equal(generateLinkCode(bytesOf(31, 30, 29, 28, 27, 26, 25, 24)), 'ZYXWVTSR');
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateLinkCode()));
    assert.equal(codes.size, 500);
  });
});

describe('formatLinkCode', () => {
  it('shows the code as XXXX-XXXX', () => {
    assert.equal(formatLinkCode('ABCD1234'), 'ABCD-1234');
  });
});

describe('a code and the website that reads it', () => {
  it('survives being shown and typed back in, in any case and with or without the dash', () => {
    for (let run = 0; run < 200; run++) {
      const code = generateLinkCode();
      const shown = formatLinkCode(code);
      assert.equal(normalizeLinkCode(shown), code);
      assert.equal(normalizeLinkCode(shown.toLowerCase()), code);
      assert.equal(normalizeLinkCode(` ${shown.replace('-', ' ')} `), code);
    }
  });

  it('reads every character of the alphabet as itself', () => {
    for (const letter of LINK_CODE_ALPHABET) {
      const code = letter.repeat(LINK_CODE_LENGTH);
      assert.equal(normalizeLinkCode(code), code, letter);
    }
  });
});
