import { fakeSupabaseClient } from './fake-supabase-client';
import {
  countHeroVideos,
  heroVideoSourceKey,
  listHeroVideos,
  saveHeroVideos,
  type HeroVideoEntry,
} from './hero-video-store';

const served = ['paz-gameplay', 'paz-counters-combos'];

const heroEntry: HeroVideoEntry = {
  heroId: 'angela',
  videoType: 'paz-gameplay',
  id: 'HRkY4e6CFow',
  title: 'Angela Guide',
};
const roleEntry: HeroVideoEntry = {
  role: 'Vanguard',
  videoType: 'paz-counters-combos',
  id: 'abc',
  title: 'Vanguard Counters',
};

describe('heroVideoSourceKey', () => {
  it('keys a hero video by hero and a fallback by role', () => {
    expect(heroVideoSourceKey(heroEntry)).toBe('hero:angela:paz-gameplay');
    expect(heroVideoSourceKey(roleEntry)).toBe('role:Vanguard:paz-counters-combos');
  });
});

describe('listHeroVideos', () => {
  it('reads only the served types, in seed order, as the API shape', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({
      data: [
        {
          hero_id: 'angela',
          role: null,
          video_type: 'paz-gameplay',
          youtube_id: 'HRkY4e6CFow',
          title: 'Angela Guide',
        },
      ],
    }));

    expect(await listHeroVideos(client)).toEqual([
      {
        heroId: 'angela',
        role: null,
        videoType: 'paz-gameplay',
        youtubeId: 'HRkY4e6CFow',
        title: 'Angela Guide',
      },
    ]);
    expect(calls[0].table).toBe('hero_videos');
    expect(calls[0].steps).toEqual([
      ['select', ['hero_id, role, video_type, youtube_id, title']],
      ['in', ['video_type', served]],
      ['order', ['sort_order']],
      ['order', ['source_key']],
      ['range', [0, 499]],
    ]);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(listHeroVideos(client)).toBeRejectedWithError(
      'Reading hero videos failed: boom',
    );
  });
});

describe('countHeroVideos', () => {
  it('counts only the served types', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ count: 103 }));

    expect(await countHeroVideos(client)).toBe(103);
    expect(calls[0].steps).toEqual([
      ['select', ['*', { count: 'exact', head: true }]],
      ['in', ['video_type', served]],
    ]);
  });
});

describe('saveHeroVideos', () => {
  it('saves each entry at its position and removes a served video no longer listed', async () => {
    const { client, calls } = fakeSupabaseClient((call) =>
      call.steps[0][0] === 'select'
        ? {
            data: [
              { source_key: 'hero:angela:paz-gameplay' },
              { source_key: 'hero:retired:paz-gameplay' },
            ],
          }
        : {},
    );

    const removed = await saveHeroVideos(client, [heroEntry, roleEntry]);

    const [method, [rows, options]] = calls[0].steps[0] as [string, [unknown[], unknown]];

    expect(method).toBe('upsert');
    expect(options).toEqual({ onConflict: 'source_key' });
    expect(rows).toEqual([
      jasmine.objectContaining({
        source_key: 'hero:angela:paz-gameplay',
        hero_id: 'angela',
        role: null,
        youtube_id: 'HRkY4e6CFow',
        sort_order: 0,
      }),
      jasmine.objectContaining({
        source_key: 'role:Vanguard:paz-counters-combos',
        hero_id: null,
        role: 'Vanguard',
        sort_order: 1,
      }),
    ]);
    expect(calls[1].steps).toContain(['in', ['video_type', served]]);
    expect(calls[2].steps).toEqual([
      ['delete', []],
      ['in', ['source_key', ['hero:retired:paz-gameplay']]],
    ]);
    expect(removed).toEqual(['hero:retired:paz-gameplay']);
  });

  it('deletes nothing when every stored video is listed', async () => {
    const { client, calls } = fakeSupabaseClient((call) =>
      call.steps[0][0] === 'select' ? { data: [{ source_key: 'hero:angela:paz-gameplay' }] } : {},
    );

    expect(await saveHeroVideos(client, [heroEntry])).toEqual([]);
    expect(calls.length).toBe(2);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(saveHeroVideos(client, [heroEntry])).toBeRejectedWithError(
      'Saving hero videos failed: boom',
    );
  });
});
