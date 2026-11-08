import { fakeSupabaseClient } from '../supabase/fake-supabase-client';
import { emptyPulseRecords, getPulseRecords, parsePulseRecords } from './pulse-records-read';

const ANSWER = {
  coveredFrom: '2026-09-20',
  categories: [
    { key: 'kills', rows: [{ heroId: 1031, value: 66, name: null }, { heroId: 1024, value: 58, name: 'Aurora' }] },
    { key: 'assists', rows: [] },
    { key: 'final_hits', rows: [] },
    { key: 'damage', rows: [] },
    { key: 'healing', rows: [] },
    { key: 'blocked', rows: [] },
  ],
};

function failure(code: string, message = 'boom') {
  return { error: { message, code } as { message: string } };
}

describe('parsePulseRecords', () => {
  it('maps the answer onto the six boards, in order, with their titles', () => {
    const records = parsePulseRecords(ANSWER);

    expect(records.status).toBe('ready');
    expect(records.coveredFrom).toBe('2026-09-20');
    expect(records.categories.map((category) => category.title)).toEqual([
      'Kills',
      'Assists',
      'Final Hits',
      'Damage',
      'Healing',
      'Damage Blocked',
    ]);
    expect(records.categories[0].rows).toEqual([
      { heroId: 1031, value: 66, name: null },
      { heroId: 1024, value: 58, name: 'Aurora' },
    ]);
  });

  it('keeps only the fields it knows, so a later column cannot reach the page', () => {
    const records = parsePulseRecords({
      ...ANSWER,
      categories: [
        { key: 'kills', rows: [{ heroId: 1031, value: 66, name: null, uid: '4242', recorder: 'abc', playedAt: 'now' }] },
      ],
    });

    expect(Object.keys(records.categories[0].rows[0]).sort()).toEqual(['heroId', 'name', 'value']);
  });

  it('fills a board the answer lacks with no rows, and ignores one it does not know', () => {
    const records = parsePulseRecords({ coveredFrom: null, categories: [{ key: 'speed', rows: [{ heroId: 1, value: 1, name: null }] }] });

    expect(records.categories.length).toBe(6);
    expect(records.categories.every((category) => category.rows.length === 0)).toBeTrue();
    expect(records.status).toBe('not-enough-data');
    expect(records.coveredFrom).toBeNull();
  });

  it('strips control and bidirectional characters from a name, and treats an empty one as anonymous', () => {
    const records = parsePulseRecords({
      coveredFrom: null,
      categories: [
        {
          key: 'kills',
          rows: [
            { heroId: 1, value: 1, name: 'Au\u202eror\u200ba\u2066' },
            { heroId: 2, value: 1, name: '\u202e\u200b' },
          ],
        },
      ],
    });

    expect(records.categories[0].rows.map((row) => row.name)).toEqual(['Aurora', null]);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parsePulseRecords(null)).toThrowError(/did not return an object/);
    expect(() => parsePulseRecords({ ...ANSWER, categories: 'none' })).toThrowError(/categories is not a list/);
    expect(() => parsePulseRecords({ ...ANSWER, categories: [{ key: 'kills', rows: [{ heroId: '1', value: 1, name: null }] }] })).toThrowError(
      /heroId is not a number/,
    );
    expect(() => parsePulseRecords({ ...ANSWER, categories: [{ key: 'kills', rows: [{ heroId: 1, value: 1, name: 7 }] }] })).toThrowError(
      /name is not a string/,
    );
    expect(() => parsePulseRecords({ ...ANSWER, coveredFrom: 'yesterday' })).toThrowError(/coveredFrom is not a calendar day/);
  });
});

describe('getPulseRecords', () => {
  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: ANSWER }));

    const records = await getPulseRecords({ getClient: () => client });

    expect(records.status).toBe('ready');
    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', ['read_pulse_records', undefined]]);
  });

  it('answers the empty state while the migration has not been applied', async () => {
    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => failure(code));

      expect(await getPulseRecords({ getClient: () => client })).toEqual(emptyPulseRecords());
    }
  });

  it('throws on any other failure, so an outage is never shown as no records', async () => {
    const { client } = fakeSupabaseClient(() => failure('42501', 'permission denied'));

    await expectAsync(getPulseRecords({ getClient: () => client })).toBeRejectedWithError(/read_pulse_records answered 42501/);
  });
});
