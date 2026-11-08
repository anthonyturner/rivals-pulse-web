import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { previewHero, type PreviewHero } from '../../hub/preview-hero';
import { heroIdentities } from '../../insights/hero-identity';
import { buildTierListView } from '../../insights/tier-list/tier-list-view';
import { buildWinRatesView } from '../../insights/win-rates/win-rates-view';
import type { Hero } from '../../heroes/hero.model';
import { STRATEGIST_GUIDES } from '../../learning/guides/strategist-guides/strategist-guides.data';

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

/** What the guides cover and whose kits they teach, read from the guides themselves. */
export function strategistPreview(): StrategistPreview {
  const heroes = new Map<string, PreviewHero>();

  for (const guide of STRATEGIST_GUIDES) {
    heroes.set(guide.heroImage, { hero: guide.heroImage, name: guide.heroFocus, imageUrl: guide.heroImage });
  }

  return { topics: [...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))], heroes: [...heroes.values()] };
}

