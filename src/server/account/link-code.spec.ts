import { normalizeLinkCode } from './link-code';

describe('normalizeLinkCode', () => {
  it('keeps a canonical code', () => {
    expect(normalizeLinkCode('0123456Z')).toBe('0123456Z');
  });

  it('reads the displayed XXXX-XXXX form', () => {
    expect(normalizeLinkCode('ABCD-EFGH')).toBe('ABCDEFGH');
  });

  it('ignores case, spaces, underscores and dashes of any length', () => {
    expect(normalizeLinkCode('  abcd efgh ')).toBe('ABCDEFGH');
    expect(normalizeLinkCode('abcd_efgh')).toBe('ABCDEFGH');
    expect(normalizeLinkCode('abcd\u2013efgh')).toBe('ABCDEFGH');
  });

  it('reads the letters that look like digits as digits', () => {
    expect(normalizeLinkCode('OoIiLl12')).toBe('00111112');
  });

  it('refuses what cannot be a code', () => {
    expect(normalizeLinkCode('')).toBeNull();
    expect(normalizeLinkCode('ABCDEFG')).toBeNull();
    expect(normalizeLinkCode('ABCDEFGHJ')).toBeNull();
    expect(normalizeLinkCode('ABCD-EFG!')).toBeNull();
    expect(normalizeLinkCode('ABCDEFGU')).toBeNull();
  });

  it('refuses a value that is not text', () => {
    expect(normalizeLinkCode(undefined)).toBeNull();
    expect(normalizeLinkCode(null)).toBeNull();
    expect(normalizeLinkCode(12345678)).toBeNull();
    expect(normalizeLinkCode({ code: 'ABCDEFGH' })).toBeNull();
  });
});
