import {
  clearPkceCookie,
  clearSessionCookie,
  readPkceState,
  readSessionTokens,
  serializePkceCookie,
  serializeSessionCookie,
} from './auth-cookies';

const asRequestCookie = (setCookie: string): string => setCookie.split(';')[0];

describe('the session cookie', () => {
  const tokens = { accessToken: 'aaa.bbb.ccc', refreshToken: 'refresh_token-1' };

  it('is HttpOnly, Secure, SameSite=Lax and limited to /api', () => {
    const cookie = serializeSessionCookie(tokens);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api;');
  });

  it('round-trips through a Cookie header among other cookies', () => {
    const header = `theme=dark; ${asRequestCookie(serializeSessionCookie(tokens))}; other=1`;

    expect(readSessionTokens(header)).toEqual(tokens);
  });

  it('carries the time of the Discord sign-in and reads it back', () => {
    const signedIn = { ...tokens, signedInAt: 1_800_000_000 };

    expect(readSessionTokens(asRequestCookie(serializeSessionCookie(signedIn)))).toEqual(signedIn);
  });

  it('reads a cookie from before the sign-in time existed, with no time', () => {
    expect(readSessionTokens('rp_session=a~b')).toEqual({ accessToken: 'a', refreshToken: 'b' });
  });

  it('refuses a sign-in time that is not whole seconds', () => {
    expect(readSessionTokens('rp_session=a~b~-1')).toBeUndefined();
    expect(readSessionTokens('rp_session=a~b~1.5')).toBeUndefined();
    expect(readSessionTokens('rp_session=a~b~')).toBeUndefined();
    expect(readSessionTokens('rp_session=a~b~1~2')).toBeUndefined();
  });

  it('is cleared by an immediately expiring cookie on the same path', () => {
    const cookie = clearSessionCookie();

    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('Path=/api;');
    expect(cookie).toContain('HttpOnly');
  });

  it('reads as signed out when absent or malformed', () => {
    expect(readSessionTokens(undefined)).toBeUndefined();
    expect(readSessionTokens('theme=dark')).toBeUndefined();
    expect(readSessionTokens('rp_session=onlyone')).toBeUndefined();
    expect(readSessionTokens('rp_session=a~b~c')).toBeUndefined();
  });

  it('refuses tokens that would not fit in one cookie', () => {
    expect(() =>
      serializeSessionCookie({ accessToken: 'a'.repeat(4000), refreshToken: 'b'.repeat(200) }),
    ).toThrowError(/over the 4096-byte limit/);
  });
});

describe('the sign-in cookie', () => {
  it('round-trips the verifier and the page to return to', () => {
    const state = { verifier: 'v'.repeat(64), next: '/account?tab=a&b=c' };

    expect(readPkceState(asRequestCookie(serializePkceCookie(state)))).toEqual(state);
  });

  it('is HttpOnly, Secure, SameSite=Lax, short-lived and limited to the auth routes', () => {
    const cookie = serializePkceCookie({ verifier: 'x', next: '/account' });

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/api/auth;');
    expect(cookie).toContain('Max-Age=600');
    expect(clearPkceCookie()).toContain('Max-Age=0');
  });

  it('is treated as absent when it is not our JSON', () => {
    expect(readPkceState('rp_pkce=%7Bnot-json')).toBeUndefined();
    expect(readPkceState('rp_pkce=' + encodeURIComponent('{"verifier":"","next":"/"}'))).toBeUndefined();
    expect(readPkceState('rp_pkce=' + encodeURIComponent('null'))).toBeUndefined();
  });
});
