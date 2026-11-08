import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { HeroSynergies } from '../../../../contracts/hero-synergies.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { heroIdentities, type HeroCellView } from '../../insights/hero-identity';
import { buildTeamCompsView } from '../../insights/team-comps/team-comps-view';
import { buildTierListView } from '../../insights/tier-list/tier-list-view';
import { buildWinRatesView } from '../../insights/win-rates/win-rates-view';
import type { Hero } from '../../heroes/hero.model';
import { STRATEGIST_GUIDES } from '../../learning/guides/strategist-guides/strategist-guides.data';

/** The hero a preview draws: enough for a portrait and a name. */
export type PreviewHero = Pick<HeroCellView, 'hero' | 'name' | 'imageUrl'>;

export const PREVIEW_TIERS: readonly TierName[] = ['S', 'A', 'B'];
export const HEROES_PER_TIER = 4;
export const WIN_RATE_ROWS = 3;

export interface TierPreviewRow {
  name: TierName;
  heroes: PreviewHero[];
}

export interface WinRatePreviewRow extends PreviewHero {
  winRateLabel: string;
  /** Where the bar's fill ends, as a share of its width. */
  barPercent: number;
}

export interface PairPreviewRow {
  role: string;
  first: PreviewHero;
  second: PreviewHero;
  winRateLabel: string;
}

export interface StrategistPreview {
  topics: string[];
  heroes: PreviewHero[];
}

/** The top heroes of the tiers a player cares most about; empty until at least one hero is placed. */
export function tierPreview(stats: HeroStats, roster: readonly Hero[]): TierPreviewRow[] {
  return buildTierListView(stats, heroIdentities(roster))
    .tiers.filter((tier) => PREVIEW_TIERS.includes(tier.name) && tier.heroes.length > 0)
    .map((tier) => ({ name: tier.name, heroes: tier.heroes.slice(0, HEROES_PER_TIER).map(previewHero) }));
}

/** The heroes with the best win rate among those that have reached the minimum, best first. */
export function winRatePreview(stats: HeroStats, roster: readonly Hero[]): WinRatePreviewRow[] {
  return buildWinRatesView(stats, null, heroIdentities(roster))
    .ranked.slice(0, WIN_RATE_ROWS)
    .map((row) => ({ ...previewHero(row), winRateLabel: row.winRateLabel, barPercent: row.barPercent }));
}

/** The best duo of each role that has one. */
export function pairPreview(synergies: HeroSynergies, roster: readonly Hero[]): PairPreviewRow[] {
  return buildTeamCompsView(synergies, heroIdentities(roster)).rolePairs.flatMap(({ role, rows }) =>
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

/** What the guides cover and whose kits they teach, read from the guides themselves. */
export function strategistPreview(): StrategistPreview {
  const heroes = new Map<string, PreviewHero>();

  for (const guide of STRATEGIST_GUIDES) {
    heroes.set(guide.heroImage, { hero: guide.heroImage, name: guide.heroFocus, imageUrl: guide.heroImage });
  }

  return { topics: [...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))], heroes: [...heroes.values()] };
}

function previewHero({ hero, name, imageUrl }: PreviewHero): PreviewHero {
  return { hero, name, imageUrl };
}
