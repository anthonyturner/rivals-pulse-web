import type { HeroSynergies } from '../../../contracts/hero-synergies.model';
import type { Hero } from '../heroes/hero.model';
import { heroIdentities } from '../insights/hero-identity';
import { buildTeamCompsView } from '../insights/team-comps/team-comps-view';
import { previewHero, type PreviewHero } from './preview-hero';

export interface PairPreviewRow {
  role: string;
  first: PreviewHero;
  second: PreviewHero;
  winRateLabel: string;
}

/** The best duo of each role that has one, ranked as the Team comps page ranks them. */
export function pairPreview(synergies: HeroSynergies, roster: readonly Hero[]): PairPreviewRow[] {
  return buildTeamCompsView(synergies, null, heroIdentities(roster)).rolePairs.flatMap(({ role, rows }) =>
    rows.length === 0
      ? []
      : [
          {
            role,
            first: previewHero(rows[0].first),
            second: previewHero(rows[0].second),
            winRateLabel: rows[0].winRateLabel,
          },
        ],
  );
}
