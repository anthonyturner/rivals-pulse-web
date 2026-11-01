import { InjectionToken, Type } from '@angular/core';

import { HouseAdComponent } from './house-ad/house-ad.component';

/** The sizes a slot can reserve, in CSS pixels. A new size is a new entry here, nowhere else. */
export const AD_SLOT_SIZES = {
  rectangle: { width: 300, height: 250 },
  halfPage: { width: 300, height: 600 },
} as const;

export type AdSlotId = keyof typeof AD_SLOT_SIZES;

export interface AdSlotSize {
  readonly width: number;
  readonly height: number;
}

/**
 * What fills an ad slot. The slot owns the reserved box; a provider owns only what is drawn inside
 * it, so swapping providers cannot move the page.
 */
export interface AdProvider {
  readonly id: string;
  /** Renders inside the slot and takes the slot's `AdSlotSize` as a required `slot` input. */
  readonly component: Type<unknown>;
  /** True when the content loads a script, so the slot renders it after hydration and never on the server. */
  readonly browserOnly: boolean;
}

export const HOUSE_AD_PROVIDER: AdProvider = {
  id: 'house',
  component: HouseAdComponent,
  browserOnly: false,
};

/** Provide a different `AdProvider` in `app.config.ts` to change what every slot shows. */
export const AD_PROVIDER = new InjectionToken<AdProvider>('AD_PROVIDER', {
  providedIn: 'root',
  factory: () => HOUSE_AD_PROVIDER,
});
