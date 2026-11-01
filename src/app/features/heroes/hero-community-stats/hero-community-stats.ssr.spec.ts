import { Component } from '@angular/core';

import { renderOnServer, serverRenderSandbox } from '../../../testing/server-render';
import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { HeroCommunityStatsComponent } from './hero-community-stats.component';

const emptyDataset: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

@Component({
  selector: 'app-root',
  imports: [HeroCommunityStatsComponent],
  template: `<app-hero-community-stats heroId="storm" heroName="Storm" [stats]="stats" />`,
})
class SsrHostComponent {
  readonly stats = emptyDataset;
}

describe('HeroCommunityStatsComponent server render', () => {
  const sandbox = serverRenderSandbox();

  beforeEach(() => sandbox.enter());
  afterEach(() => sandbox.leave());

  it('renders the designed empty state, with no zeros or NaN, from an empty dataset', async () => {
    const html = await renderOnServer(SsrHostComponent);

    expect(html).toContain('Not enough data yet');
    expect(html).toContain('No match recorded by RivalsPulse players has Storm yet.');
    expect(html).toContain('RivalsPulse players');
    expect(html).not.toMatch(/NaN|Infinity|<dl/);
  });
});
