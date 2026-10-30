import type { PortalCard } from './app/features/home/home-content.model';
import { fakeSupabaseClient } from './fake-supabase-client';
import {
  countHomeContentBlocks,
  countHomePortals,
  getHomeContentBlock,
  getHomeContentBlocks,
  listHomePortals,
  replaceHomePortals,
  saveHomeContentBlocks,
} from './home-content-store';

function portal(title: string): PortalCard {
  return { title, description: `${title} page`, path: `/${title.toLowerCase()}`, image: `${title}.png` };
}

describe('listHomePortals', () => {
  it('returns the stored cards in display order', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({
      data: [{ raw_json: portal('Heroes') }, { raw_json: portal('Glossary') }],
    }));

    expect(await listHomePortals(client)).toEqual([portal('Heroes'), portal('Glossary')]);
    expect(calls[0].table).toBe('home_portals');
    expect(calls[0].steps).toContain(['order', ['sort_order']]);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(listHomePortals(client)).toBeRejectedWithError(
      'Reading home portals failed: boom',
    );
  });
});

describe('replaceHomePortals', () => {
  it('writes each card at its position, then removes the cards past the end', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await replaceHomePortals(client, [portal('Heroes'), portal('Glossary')], '2026-10-30T03:00:00.000Z');

    const upsert = calls[0].steps.find(([method]) => method === 'upsert')!;
    expect(upsert[1]).toEqual([
      [
        jasmine.objectContaining({ title: 'Heroes', sort_order: 0, raw_json: portal('Heroes') }),
        jasmine.objectContaining({ title: 'Glossary', sort_order: 1, raw_json: portal('Glossary') }),
      ],
      { onConflict: 'sort_order' },
    ]);
    expect(calls[1].steps).toEqual([
      ['delete', []],
      ['gte', ['sort_order', 2]],
    ]);
  });

  it('removes nothing when the save fails', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(
      replaceHomePortals(client, [portal('Heroes')], '2026-10-30T03:00:00.000Z'),
    ).toBeRejectedWithError('Saving home portals failed: boom');
    expect(calls.length).toBe(1);
  });
});

describe('getHomeContentBlocks', () => {
  it('keys each payload by its content key, keeping an empty block as null', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({
      data: [
        { content_key: 'lastChecked', payload: '2026-10-30' },
        { content_key: 'latestTuning', payload: null },
        { content_key: 'quickLinks', payload: [{ label: 'Current Season', value: 'Season 10' }] },
      ],
    }));

    expect(await getHomeContentBlocks(client)).toEqual({
      lastChecked: '2026-10-30',
      latestTuning: null,
      quickLinks: [{ label: 'Current Season', value: 'Season 10' }],
    });
    expect(calls[0].table).toBe('home_content_blocks');
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(getHomeContentBlocks(client)).toBeRejectedWithError(
      'Reading home content failed: boom',
    );
  });
});

describe('getHomeContentBlock', () => {
  it('returns the stored value', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: { payload: ['link'] } }));

    expect(await getHomeContentBlock<string[]>(client, 'quickLinks')).toEqual(['link']);
    expect(calls[0].steps).toContain(['eq', ['content_key', 'quickLinks']]);
  });

  it('returns undefined for a missing or empty block', async () => {
    const missing = fakeSupabaseClient(() => ({ data: null }));
    const empty = fakeSupabaseClient(() => ({ data: { payload: null } }));

    expect(await getHomeContentBlock(missing.client, 'quickLinks')).toBeUndefined();
    expect(await getHomeContentBlock(empty.client, 'latestTuning')).toBeUndefined();
  });
});

describe('saveHomeContentBlocks', () => {
  it('writes every block in one upsert, storing an empty block as null', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveHomeContentBlocks(
      client,
      { lastChecked: '2026-10-30', latestTuning: null },
      '2026-10-30T03:00:00.000Z',
    );

    expect(calls.length).toBe(1);
    expect(calls[0].steps).toEqual([
      [
        'upsert',
        [
          [
            { content_key: 'lastChecked', payload: '2026-10-30', updated_at: '2026-10-30T03:00:00.000Z' },
            { content_key: 'latestTuning', payload: null, updated_at: '2026-10-30T03:00:00.000Z' },
          ],
          { onConflict: 'content_key' },
        ],
      ],
    ]);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(
      saveHomeContentBlocks(client, { lastChecked: '2026-10-30' }, '2026-10-30T03:00:00.000Z'),
    ).toBeRejectedWithError('Saving home content failed: boom');
  });
});

describe('home content counts', () => {
  it('count without reading rows', async () => {
    const { client, calls } = fakeSupabaseClient((call) => ({
      count: call.table === 'home_portals' ? 6 : 13,
    }));

    expect(await countHomePortals(client)).toBe(6);
    expect(await countHomeContentBlocks(client)).toBe(13);
    expect(calls[0].steps[0]).toEqual(['select', ['*', { count: 'exact', head: true }]]);
  });
});
