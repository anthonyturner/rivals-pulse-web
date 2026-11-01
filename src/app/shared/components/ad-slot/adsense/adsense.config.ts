import { InjectionToken } from '@angular/core';

import type { AdSlotId } from '../ad-slot.types';

export interface AdSenseConfig {
  readonly publisherId: string;
  /** The AdSense ad unit id for each placement. A placement with no id shows the house ad. */
  readonly slotIds: Readonly<Partial<Record<AdSlotId, string>>>;
}

/**
 * The one place AdSense is configured. The publisher id is public and must match the loader in
 * `src/index.html` and the line in `public/ads.txt`; nothing checks that, so change all three together.
 *
 * To go live, paste the ad unit id (the digits from AdSense, Ads, By ad unit, "data-ad-slot") into
 * `rectangle`, the sidebar placement. Left empty, the sidebar shows the house ad and asks Google for
 * nothing.
 */
export const ADSENSE_CONFIG = new InjectionToken<AdSenseConfig>('ADSENSE_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    publisherId: 'ca-pub-5750718532449576',
    slotIds: { rectangle: '' },
  }),
});

/** The ad unit id for a placement, or null when none is set. */
export function adSenseSlotId(config: AdSenseConfig, slot: AdSlotId): string | null {
  return usable(config.slotIds[slot]);
}

/** True once at least one placement has an ad unit id, which is when AdSense is worth loading ad units for. */
export function hasAdSenseSlot(config: AdSenseConfig): boolean {
  return Object.values(config.slotIds).some((id) => usable(id) !== null);
}

function usable(id: string | undefined): string | null {
  return id?.trim() || null;
}
