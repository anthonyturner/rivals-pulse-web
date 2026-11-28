import type { WinRateRowView } from '../hero-table/win-rates-view';
import { buildHeroScatterView } from './hero-scatter-view';

function row(hero: string, winRate: number, pickRate: number | null, appearances: number, role: string | null = 'Duelist'): WinRateRowView {
  return {
    hero,
    name: hero.charAt(0).toUpperCase() + hero.slice(1),
    role,
    imageUrl: `/images/heroes/${hero}.png`,
    rank: 1,
    winRate,
    winRateLabel: `${winRate.toFixed(1)}%`,
    pickRate,
    pickRateLabel: pickRate === null ? 'Not available' : `${pickRate.toFixed(1)}%`,
    barPercent: winRate,
    tone: winRate > 50 ? 'above' : winRate < 50 ? 'below' : 'even',
    appearances,
    winsGamesLabel: `${Math.round((winRate * appearances) / 100)} / ${appearances}`,
    winsGamesSpoken: `${Math.round((winRate * appearances) / 100)} wins in ${appearances} games`,
  };
}

describe('buildHeroScatterView', () => {
  it('draws nothing when no hero can be placed', () => {
    expect(buildHeroScatterView([])).toBeNull();
    expect(buildHeroScatterView([row('hulk', 55, null, 30)])).toBeNull();
  });

  it('places each hero by its pick rate and win rate, and links it to its page', () => {
    const view = buildHeroScatterView([row('hulk', 55, 12.5, 40)]);

    expect(view?.points).toEqual([
      jasmine.objectContaining({
        id: 'hulk',
        label: 'Hulk',
        x: 12.5,
        y: 55,
        role: 'Duelist',
        link: ['/heroes', 'hulk'],
        figures: ['12.5%', '55.0%', '22 wins in 40 games'],
        description: 'Hulk: 55.0% win rate, 12.5% pick rate, 22 wins in 40 games',
      }),
    ]);
  });

  it('leaves out a hero with no pick rate and keeps the rest', () => {
    const view = buildHeroScatterView([row('hulk', 55, null, 40), row('thor', 48, 9, 30)]);

    expect(view?.points.map((point) => point.id)).toEqual(['thor']);
  });

  it('draws the heroes with the most games last, so they are on top where portraits overlap', () => {
    const view = buildHeroScatterView([row('thor', 48, 9, 90), row('hulk', 55, 9, 30), row('loki', 50, 9, 30)]);

    expect(view?.points.map((point) => point.id)).toEqual(['hulk', 'loki', 'thor']);
  });

  it('gives the win rate a window around the heroes and the 50% line, with round ticks and a guide at 50%', () => {
    const view = buildHeroScatterView([row('hulk', 38, 5, 40), row('thor', 61, 9, 30)]);

    expect(view?.yAxis.min).toBe(35);
    expect(view?.yAxis.max).toBe(65);
    expect(view?.yAxis.ticks.map((tick) => tick.value)).toEqual([40, 50, 60]);
    expect(view?.guides).toEqual([{ axis: 'y', value: 50, label: '50% win rate' }]);
  });

  it('runs the pick rate axis from 0 to a round number past the largest, even above 100%', () => {
    const view = buildHeroScatterView([row('hulk', 55, 76.3, 40), row('thor', 48, 9, 30)]);

    expect(view?.xAxis.min).toBe(0);
    expect(view?.xAxis.max).toBe(80);
    expect(view?.xAxis.ticks.map((tick) => tick.label)).toEqual(['0%', '20%', '40%', '60%', '80%']);
  });

  it('prints no NaN or undefined in any label', () => {
    const view = buildHeroScatterView([row('hulk', 55, 12.5, 40)]);

    expect(JSON.stringify(view)).not.toMatch(/NaN|undefined/);
  });
});
