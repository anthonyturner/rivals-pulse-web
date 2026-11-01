import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';

/**
 * A hero's portrait and name, with the page's own figures beside or under it.
 *
 * Pass the lines under the name as content, and mark an element `tileFigure` to put it at the right
 * of the name. Give `heroId` to make the whole tile a link to that hero on the Heroes page.
 *
 * To pick a hero instead, put the tile inside a `<button>`, set `selectable` so it reacts to the
 * pointer, and `selected` for the one chosen. A tile with a `heroId` must not sit inside a button.
 */
@Component({
  selector: 'app-hero-tile',
  imports: [HeroImageFallbackDirective, RouterLink],
  templateUrl: './hero-tile.component.html',
  styleUrl: './hero-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.selectable]': 'selectable()',
    '[class.selected]': 'selected()',
  },
})
export class HeroTileComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input.required<string>();
  readonly heroId = input<string | null>(null);
  readonly selectable = input(false, { transform: booleanAttribute });
  readonly selected = input(false, { transform: booleanAttribute });

  protected readonly heroQuery = computed(() => {
    const hero = this.heroId();

    return hero === null ? null : { hero };
  });
}
