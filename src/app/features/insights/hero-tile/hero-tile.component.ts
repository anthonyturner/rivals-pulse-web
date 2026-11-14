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
 *
 * `artLed` gives the tile the look of the redesigned pages: a rounder card washed in the hero's
 * role colour, a ringed portrait and, for a linked tile, a lift and a focus ring. It reads `role`
 * for the tint; with none the wash is the accent. The plain tile is the default. The tile sets
 * `--tile-role-color` and `--tile-role-ink`, which the content placed inside it can read.
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
    '[class.art-led]': 'artLed()',
    '[class.linked]': 'heroId() !== null',
    '[attr.data-role]': 'roleKey()',
  },
})
export class HeroTileComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input.required<string>();
  readonly heroId = input<string | null>(null);
  readonly selectable = input(false, { transform: booleanAttribute });
  readonly selected = input(false, { transform: booleanAttribute });
  readonly artLed = input(false, { transform: booleanAttribute });
  /** The hero's role, such as `Vanguard`; only the art-led tile reads it. */
  readonly role = input<string | null>(null);

  /** The role as a style key, or null when the tile is plain or the hero has no role, so nothing is tinted by a guess. */
  protected readonly roleKey = computed(() => {
    const role = this.role()?.trim().toLowerCase();

    return this.artLed() && role ? role : null;
  });
}
