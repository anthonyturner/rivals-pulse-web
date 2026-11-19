import type { PreviewHero } from '../../hub/preview-hero';
import { STRATEGIST_GUIDES } from '../../learning/guides/strategist-guides/strategist-guides.data';

export interface StrategistPreview {
  topics: string[];
  heroes: PreviewHero[];
}

/** What the guides cover and whose kits they teach, read from the guides themselves. */
export function strategistPreview(): StrategistPreview {
  const heroes = new Map<string, PreviewHero>();

  for (const guide of STRATEGIST_GUIDES) {
    heroes.set(guide.heroImage, { hero: guide.heroImage, name: guide.heroFocus, imageUrl: guide.heroImage });
  }

  return { topics: [...new Set(STRATEGIST_GUIDES.map((guide) => guide.category))], heroes: [...heroes.values()] };
}

