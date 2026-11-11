import { convertToParamMap } from '@angular/router';

import { heroStatsQuery, heroStatsScope, heroStatsView, sameHeroStatsScope } from './hero-stats-request';

const params = (query: Record<string, string>) => convertToParamMap(query);

describe('the Heroes tab request', () => {
  describe('the layout', () => {
    it('is the table unless the address says tiers', () => {
      expect(heroStatsView(params({}))).toBe('table');
      expect(heroStatsView(params({ view: 'table' }))).toBe('table');
      expect(heroStatsView(params({ view: 'tiers' }))).toBe('tiers');
    });

    it('is the table for a layout the tab does not have', () => {
      for (const odd of ['', 'Tiers', 'grid', 'tiers ']) {
        expect(heroStatsView(params({ view: odd }))).withContext(odd).toBe('table');
      }
    });
  });

  describe('the half-season and mode', () => {
    it('is the current half-season in the default mode when the address names neither', () => {
      expect(heroStatsScope(params({}))).toEqual({ season: undefined, mode: 'all' });
    });

    it('reads a whole or half season number and a mode the site counts', () => {
      expect(heroStatsScope(params({ season: '10.5', mode: 'competitive' }))).toEqual({
        season: 10.5,
        mode: 'competitive',
      });
      expect(heroStatsScope(params({ season: '9', mode: 'quick-match' }))).toEqual({ season: 9, mode: 'quick-match' });
    });

    it('ignores a half-season that is not a whole or half season number', () => {
      for (const odd of ['week-2', '', '1e1', '-3', '0', '9.25', '10.0', ' 9', '9abc']) {
        expect(heroStatsScope(params({ season: odd })).season).withContext(odd).toBeUndefined();
      }
    });

    it('ignores a mode the site does not count', () => {
      expect(heroStatsScope(params({ mode: 'ranked' })).mode).toBe('all');
      expect(heroStatsScope(params({ mode: '' })).mode).toBe('all');
    });

    it('compares two scopes by half-season and mode', () => {
      expect(sameHeroStatsScope({ season: 10, mode: 'all' }, { season: 10, mode: 'all' })).toBeTrue();
      expect(sameHeroStatsScope({ season: 10, mode: 'all' }, { season: 9, mode: 'all' })).toBeFalse();
      expect(sameHeroStatsScope({ season: undefined, mode: 'all' }, { season: undefined, mode: 'arcade' })).toBeFalse();
    });
  });

  describe('the query for a choice', () => {
    it('removes a choice that is the default, so the plain address stays the default view', () => {
      expect(heroStatsQuery({ view: 'table' })).toEqual({ view: null });
      expect(heroStatsQuery({ mode: 'all' })).toEqual({ mode: null });
      expect(heroStatsQuery({ season: undefined })).toEqual({ season: null });
    });

    it('sets a choice that is not the default', () => {
      expect(heroStatsQuery({ view: 'tiers' })).toEqual({ view: 'tiers' });
      expect(heroStatsQuery({ mode: 'competitive' })).toEqual({ mode: 'competitive' });
      expect(heroStatsQuery({ season: 10.5 })).toEqual({ season: '10.5' });
    });

    it('leaves out what the choice does not mention, so the rest of the address is kept', () => {
      expect(heroStatsQuery({ mode: 'arcade' })).toEqual({ mode: 'arcade' });
    });
  });
});
