import type { HeroCellView } from '../insights/hero-identity';

/** The hero a preview draws: enough for a portrait and a name. */
export type PreviewHero = Pick<HeroCellView, 'hero' | 'name' | 'imageUrl'>;

/** Keeps only what a preview draws, so a row with more on it (a role, a rate) hands over just the hero. */
export function previewHero({ hero, name, imageUrl }: PreviewHero): PreviewHero {
  return { hero, name, imageUrl };
}
