import type { HeroStatsHalfSeason } from '../../../contracts/hero-stats.model';
import { seasonOptions } from './half-season-view';

const half = (id: number): HeroStatsHalfSeason => ({ id, label: `Season ${id}`, startsAt: null, endsAt: null });

describe('seasonOptions', () => {
  it('lists the newest half-season first', () => {
    expect(seasonOptions([half(10), half(10.5)])).toEqual([
      { id: 10.5, label: 'Season 10.5' },
      { id: 10, label: 'Season 10' },
    ]);
  });
});
