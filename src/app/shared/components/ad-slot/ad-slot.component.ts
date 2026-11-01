import { isPlatformBrowser, NgComponentOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';

import { AD_PROVIDER, AD_SLOT_SIZES, AdSlotId } from './ad-slot.types';

/**
 * A fixed-size box that an `AdProvider` fills. The box is sized by the slot id alone, so the
 * content can load late, be replaced or be missing without moving anything around it. This
 * component does not know which provider is behind it.
 */
@Component({
  selector: 'app-ad-slot',
  imports: [NgComponentOutlet],
  templateUrl: './ad-slot.component.html',
  styleUrl: './ad-slot.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.width.px]': 'size().width',
    '[style.height.px]': 'size().height',
    '[attr.data-provider]': 'provider.id',
  },
})
export class AdSlotComponent {
  readonly slot = input.required<AdSlotId>();

  protected readonly provider = inject(AD_PROVIDER);
  private readonly hydrated = signal(false);

  protected readonly size = computed(() => AD_SLOT_SIZES[this.slot()]);
  protected readonly content = computed(() =>
    this.provider.browserOnly && !this.hydrated() ? null : this.provider.component,
  );
  protected readonly contentInputs = computed(() => ({ slot: this.size() }));

  constructor() {
    // Checked explicitly: a browser-only provider must never render on the server, even where the
    // render hook would run there.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.hydrated.set(true));
    }
  }
}
