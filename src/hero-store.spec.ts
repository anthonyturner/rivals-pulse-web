import type { Hero } from './app/features/heroes/hero.model';
import { fakeSupabaseClient } from './fake-supabase-client';
import {
  compareHeroRows,
  countHeroes,
  deleteHero,
  getHero,
  listHeroes,
  saveHero,
} from './hero-store';

function hero(id: string): Hero {
  return { id, name: id } as Hero;
}

describe('compareHeroRows', () => {
  const sortedNames = (names: string[]) =>
    names
      .map((name, index) => ({ id: String(index), name }))
      .sort(compareHeroRows)
      .map((row) => row.name);

  it('ignores case, as COLLATE NOCASE did', () => {
    expect(sortedNames(['zed', 'Alpha', 'beta'])).toEqual(['Alpha', 'beta', 'zed']);
  });

  it('compares punctuation by character code, not by the database collation', () => {
    expect(sortedNames(['Cloak & Dagger', 'Captain America', 'Cyclops'])).toEqual([
      'Captain America',
      'Cloak & Dagger',
      'Cyclops',
    ]);
    expect(sortedNames(['Iron Man', 'Ironheart', 'Iron Fist'])).toEqual([
      'Iron Fist',
      'Iron Man',
      'Ironheart',
    ]);
  });

  it('breaks a tie on the id', () => {
    const rows = [
      { id: 'b', name: 'Jeff the Land Shark' },
      { id: 'a', name: 'Jeff The Land Shark' },
    ];

    expect(rows.sort(compareHeroRows).map((row) => row.id)).toEqual(['a', 'b']);
  });
});

describe('listHeroes', () => {
  it('reads every page and returns the heroes ordered by name', async () => {
    const stored = Array.from({ length: 1200 }, (_, index) => {
      const id = `hero-${String(index).padStart(4, '0')}`;

      return { id, name: `Name ${String(1200 - index).padStart(4, '0')}`, raw_json: hero(id) };
    });
    const { client, calls } = fakeSupabaseClient((call) => {
      const [from, to] = call.steps.find(([method]) => method === 'range')![1] as [number, number];

      return { data: stored.slice(from, to + 1) };
    });

    const heroes = await listHeroes(client);

    expect(calls.length).toBe(3);
    expect(calls[0].table).toBe('hero_content');
    expect(calls[0].steps.map(([method]) => method)).toEqual(['select', 'order', 'range']);
    expect(heroes.length).toBe(1200);
    expect(heroes[0].id).toBe('hero-1199');
    expect(heroes[1199].id).toBe('hero-0000');
  });

  it('stops after a single short page', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({
      data: [{ id: 'angela', name: 'Angela', raw_json: hero('angela') }],
    }));

    expect(await listHeroes(client)).toEqual([hero('angela')]);
    expect(calls.length).toBe(1);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(listHeroes(client)).toBeRejectedWithError('Reading heroes failed: boom');
  });
});

describe('getHero', () => {
  it('returns the stored record', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: { raw_json: hero('angela') } }));

    expect(await getHero(client, 'angela')).toEqual(hero('angela'));
    expect(calls[0].steps).toContain(['eq', ['id', 'angela']]);
  });

  it('returns undefined for an unknown hero', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: null }));

    expect(await getHero(client, 'nobody')).toBeUndefined();
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(getHero(client, 'angela')).toBeRejectedWithError(
      'Reading hero angela failed: boom',
    );
  });
});

describe('countHeroes', () => {
  it('counts without reading rows', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ count: 54 }));

    expect(await countHeroes(client)).toBe(54);
    expect(calls[0].steps[0]).toEqual(['select', ['*', { count: 'exact', head: true }]]);
  });
});

describe('saveHero', () => {
  it('hands the whole record to the save_hero function', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveHero(client, hero('angela'));

    expect(calls[0].steps).toEqual([['rpc', ['save_hero', { p_hero: hero('angela') }]]]);
  });

  it('names the hero when the save fails', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(saveHero(client, hero('angela'))).toBeRejectedWithError(
      'Saving hero angela failed: boom',
    );
  });
});

describe('deleteHero', () => {
  it('deletes by id', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await deleteHero(client, 'jubilee');

    expect(calls[0].table).toBe('hero_content');
    expect(calls[0].steps).toEqual([
      ['delete', []],
      ['eq', ['id', 'jubilee']],
    ]);
  });

  it('names the failure', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(deleteHero(client, 'jubilee')).toBeRejectedWithError(
      'Deleting hero jubilee failed: boom',
    );
  });
});
