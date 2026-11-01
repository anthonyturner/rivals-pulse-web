import { inject, Provider } from '@angular/core';

import { AD_PROVIDER, AdProvider, HOUSE_AD_PROVIDER } from '../ad-slot.types';
import { AdSenseAdComponent } from './adsense-ad.component';
import { ADSENSE_CONFIG, hasAdSenseSlot } from './adsense.config';

export const ADSENSE_AD_PROVIDER: AdProvider = {
  id: 'adsense',
  component: AdSenseAdComponent,
  browserOnly: true,
};

/**
 * Makes AdSense what fills the ad slots, once an ad unit id is configured. Until then the house ad
 * stays the provider, so the server still renders it and nothing waits for the browser.
 */
export function provideAdSense(): Provider {
  return {
    provide: AD_PROVIDER,
    useFactory: (): AdProvider => (hasAdSenseSlot(inject(ADSENSE_CONFIG)) ? ADSENSE_AD_PROVIDER : HOUSE_AD_PROVIDER),
  };
}
