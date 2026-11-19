import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import type { AdSlotSize } from '../ad-slot.types';

/**
 * One AdSense ad unit: the `<ins class="adsbygoogle">` element, and the request that fills it. The
 * request is made once, when the element first renders, so a new ad means a new instance of this
 * component. It only ever runs in the browser.
 */
@Component({
  selector: 'ins[appAdsenseUnit]',
  template: '',
  styleUrl: './adsense-unit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'adsbygoogle',
    '[style.width.px]': 'size().width',
    '[style.height.px]': 'size().height',
    '[attr.data-ad-client]': 'publisherId()',
    '[attr.data-ad-slot]': 'adSlotId()',
  },
})
export class AdSenseUnitComponent {
  readonly publisherId = input.required<string>();
  readonly adSlotId = input.required<string>();
  readonly size = input.required<AdSlotSize>();

  constructor() {
    const view = inject(DOCUMENT).defaultView;

    afterNextRender(() => {
      if (view) {
        requestAd(view);
      }
    });
  }
}

/** The standard AdSense request, `(adsbygoogle = adsbygoogle || []).push({})`, for the `ins` elements not yet filled. */
function requestAd(view: Window): void {
  try {
    const existing: unknown = Reflect.get(view, 'adsbygoogle');
    let queue: object;
    if (typeof existing === 'object' && existing !== null) {
      queue = existing;
    } else {
      queue = [];
      Reflect.set(view, 'adsbygoogle', queue);
    }

    const push: unknown = Reflect.get(queue, 'push');
    if (typeof push === 'function') {
      Reflect.apply(push, queue, [{}]);
    }
  } catch (error: unknown) {
    console.error('AdSense could not fill the ad unit', error);
  }
}
