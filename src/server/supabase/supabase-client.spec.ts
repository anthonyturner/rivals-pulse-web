import { createSupabaseClient, findMissingSupabaseEnv, getSupabaseStatus } from './supabase-client';

const configuredEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test-only',
};

function respondWith(status: number): typeof fetch {
  return async () =>
    new Response(null, { status, headers: { 'content-range': '*/3' } });
}

describe('createSupabaseClient', () => {
  it('names every missing variable', () => {
    expect(() => createSupabaseClient({})).toThrowError(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  });

  it('names only the variable that is missing', () => {
    expect(() => createSupabaseClient({ SUPABASE_URL: configuredEnv.SUPABASE_URL })).toThrowError(
      'Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY.',
    );
  });

  it('treats a blank value as missing', () => {
    expect(findMissingSupabaseEnv({ ...configuredEnv, SUPABASE_URL: '  ' })).toEqual([
      'SUPABASE_URL',
    ]);
  });

  it('never puts a key value in the error', () => {
    expect(() =>
      createSupabaseClient({ SUPABASE_SERVICE_ROLE_KEY: configuredEnv.SUPABASE_SERVICE_ROLE_KEY }),
    ).toThrowMatching((error: Error) => !error.message.includes('sb_secret_'));
  });

  it('creates a client when both variables are set', () => {
    expect(createSupabaseClient(configuredEnv)).toBeDefined();
  });
});

describe('getSupabaseStatus', () => {
  it('reports unconfigured without calling the network', async () => {
    const fetchSpy = jasmine.createSpy('fetch');

    expect(await getSupabaseStatus({}, { fetch: fetchSpy })).toEqual({
      configured: false,
      reachable: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports reachable when the head-only count succeeds', async () => {
    const fetchSpy = jasmine.createSpy('fetch').and.callFake(respondWith(200));

    expect(await getSupabaseStatus(configuredEnv, { fetch: fetchSpy })).toEqual({
      configured: true,
      reachable: true,
    });

    const [url, init] = fetchSpy.calls.mostRecent().args as [string, RequestInit];
    expect(init.method).toBe('HEAD');
    expect(url).toContain('/rest/v1/players');
  });

  it('reports unreachable when Supabase answers with an error', async () => {
    expect(await getSupabaseStatus(configuredEnv, { fetch: respondWith(401) })).toEqual({
      configured: true,
      reachable: false,
    });
  });

  it('reports unreachable, without throwing, when SUPABASE_URL is malformed', async () => {
    const fetchSpy = jasmine.createSpy('fetch');

    expect(
      await getSupabaseStatus(
        { ...configuredEnv, SUPABASE_URL: 'example.supabase.co' },
        { fetch: fetchSpy },
      ),
    ).toEqual({ configured: true, reachable: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports unreachable when the request fails', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };

    expect(await getSupabaseStatus(configuredEnv, { fetch: failingFetch })).toEqual({
      configured: true,
      reachable: false,
    });
  });
});
