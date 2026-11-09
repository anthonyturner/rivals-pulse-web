import { fakeSupabaseClient } from './fake-supabase-client';
import { callReadFunction } from './read-function';

describe('callReadFunction', () => {
  it('calls the one function, with no arguments, and returns its answer', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: { ok: 1 } }));

    expect(await callReadFunction(client, 'read_example')).toEqual({ ok: 1 });
    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', ['read_example', undefined]]);
    expect(calls[0].steps.map(([method]) => method)).toContain('retry');
  });

  it('answers null, and says so, while the function is not in the database yet', async () => {
    spyOn(console, 'warn');

    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => ({ error: { message: 'missing', code } as { message: string } }));

      expect(await callReadFunction(client, 'read_example')).toBeNull();
    }

    expect(console.warn).toHaveBeenCalledWith(jasmine.stringContaining('read_example is not in the database yet'));
  });

  it('throws any other failure, naming the function and the code but not the data', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'canceling statement', code: '57014' } as { message: string } }));

    await expectAsync(callReadFunction(client, 'read_example')).toBeRejectedWithError(
      'read_example failed (57014): canceling statement',
    );
  });
});
