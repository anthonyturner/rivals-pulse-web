import type { GlossaryTerm } from './app/features/reference/glossary/glossary.model';
import { fakeSupabaseClient, type RecordedCall } from './fake-supabase-client';
import {
  countGlossaryTerms,
  listGlossaryTermIds,
  listGlossaryTerms,
  saveGlossaryTerms,
} from './glossary-store';

function term(id: string): GlossaryTerm {
  return {
    id,
    term: id.toUpperCase(),
    category: 'Gaming Chat',
    definition: 'A definition.',
    coachNote: 'A note.',
    example: 'An example.',
    relatedTerms: ['Chat'],
    sourceName: 'Manual seed data',
    sourceUrl: '/glossary',
  };
}

function rangeOf(call: RecordedCall): [number, number] {
  return call.steps.find(([method]) => method === 'range')![1] as [number, number];
}

describe('listGlossaryTerms', () => {
  it('reads every page in the stored order and returns the records', async () => {
    const stored = Array.from({ length: 1200 }, (_, index) => ({
      raw_json: term(`term-${String(index).padStart(4, '0')}`),
    }));
    const { client, calls } = fakeSupabaseClient((call) => {
      const [from, to] = rangeOf(call);

      return { data: stored.slice(from, to + 1) };
    });

    const terms = await listGlossaryTerms(client);

    expect(calls.length).toBe(3);
    expect(calls[0].table).toBe('glossary_terms');
    expect(calls[0].steps).toEqual([
      ['select', ['raw_json']],
      ['order', ['term_sort_key']],
      ['order', ['id']],
      ['range', [0, 499]],
    ]);
    expect(terms.length).toBe(1200);
    expect(terms[0]).toEqual(term('term-0000'));
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(listGlossaryTerms(client)).toBeRejectedWithError(
      'Reading glossary terms failed: boom',
    );
  });
});

describe('listGlossaryTermIds', () => {
  it('returns the stored ids', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: [{ id: 'afk' }, { id: 'dive' }] }));

    expect(await listGlossaryTermIds(client)).toEqual(new Set(['afk', 'dive']));
    expect(calls[0].steps[0]).toEqual(['select', ['id']]);
  });
});

describe('countGlossaryTerms', () => {
  it('counts without reading rows', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ count: 143 }));

    expect(await countGlossaryTerms(client)).toBe(143);
    expect(calls[0].steps[0]).toEqual(['select', ['*', { count: 'exact', head: true }]]);
  });
});

describe('saveGlossaryTerms', () => {
  it('upserts each term by id, with its record and the repeated columns', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveGlossaryTerms(client, [term('afk')]);

    const [method, [rows, options]] = calls[0].steps[0] as [string, [unknown[], unknown]];

    expect(calls[0].table).toBe('glossary_terms');
    expect(method).toBe('upsert');
    expect(options).toEqual({ onConflict: 'id' });
    expect(rows).toEqual([
      jasmine.objectContaining({
        id: 'afk',
        term: 'AFK',
        coach_note: 'A note.',
        related_terms: ['Chat'],
        source_name: 'Manual seed data',
        source_url: '/glossary',
        raw_json: term('afk'),
      }),
    ]);
  });

  it('never writes the generated sort key', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveGlossaryTerms(client, [term('afk')]);

    const rows = calls[0].steps[0][1][0] as Record<string, unknown>[];

    expect(Object.keys(rows[0])).not.toContain('term_sort_key');
  });

  it('makes no request for an empty list', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveGlossaryTerms(client, []);

    expect(calls.length).toBe(0);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(saveGlossaryTerms(client, [term('afk')])).toBeRejectedWithError(
      'Saving glossary terms failed: boom',
    );
  });
});
