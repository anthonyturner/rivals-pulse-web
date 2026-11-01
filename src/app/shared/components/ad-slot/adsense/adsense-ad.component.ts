import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { GoogleConsentService } from '../../../../core/consent/google-consent.service';
import type { AdSlotId, AdSlotSize } from '../ad-slot.types';
import { HouseAdComponent } from '../house-ad/house-ad.component';
import { AdSenseUnitComponent } from './adsense-unit.component';
import { ADSENSE_CONFIG, adSenseSlotId } from './adsense.config';

/**
 * Fills an ad slot with a Google AdSense ad when it may: an ad unit id is set, and Google's consent
 * message reports the visitor agreed (or that no consent is needed where they are). In every other
 * case, including while the answer is still pending, the slot shows the house ad and asks Google
 * for nothing.
 *
 * Each page the visitor reaches asks Google for a new ad. The sidebar stays on screen as they move
 * between pages, so this replaces the ad unit itself rather than relying on a page load.
 */
@Component({
  selector: 'app-adsense-ad',
  imports: [AdSenseUnitComponent, HouseAdComponent],
  templateUrl: './adsense-ad.component.html',
  styleUrl: './adsense-ad.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdSenseAdComponent {
  readonly slotId = input.required<AdSlotId>();
  readonly size = input.required<AdSlotSize>();

  protected readonly config = inject(ADSENSE_CONFIG);

  private readonly consent = inject(GoogleConsentService);
  private readonly router = inject(Router);

  /**
   * The page the visitor is on. A link to a section of the same page or a change to its query does
   * not change it, because Google's policy does not allow refreshing an ad without a new page.
   */
  private readonly page = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => pathOf(event.urlAfterRedirects)),
    ),
    { initialValue: pathOf(this.router.url) },
  );

  /** Zero or one ad unit. A new `page` is a new key, so the previous unit is removed before the next is added. */
  protected readonly units = computed(() => {
    const adSlotId = adSenseSlotId(this.config, this.slotId());

    return adSlotId !== null && this.consent.status() === 'granted' ? [{ page: this.page(), adSlotId }] : [];
  });
}

function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0];
}
