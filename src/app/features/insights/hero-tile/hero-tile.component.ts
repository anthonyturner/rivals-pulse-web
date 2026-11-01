import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * A hero's portrait and name, with the page's own figures beside or under it.
 *
 * Pass one element for the lines under the name, and mark an element `tileFigure` to put it at the
 * right of the name. Give `heroId` to make the whole tile a link to that hero on the Heroes page.
 */
@Component({
  selector: 'app-hero-tile',
  imports: [RouterLink],
  templateUrl: './hero-tile.component.html',
  styleUrl: './hero-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroTileComponent {
  readonly name = input.required<string>();
  readonly imageUrl = input.required<string>();
  readonly heroId = input<string | null>(null);

  protected readonly heroQuery = computed(() => {
    const hero = this.heroId();

    return hero === null ? null : { hero };
  });

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
