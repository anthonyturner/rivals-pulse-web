import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroImageFallbackDirective } from '../../../../../shared/directives/hero-image-fallback.directive';
import { SourceLink } from '../techniques.data';

export interface TechniqueTile {
  title: string;
  image: string;
  caption: string | null;
  body: string;
  practice: string | null;
  tags: string | null;
  links: readonly SourceLink[];
}

interface TileLink extends SourceLink {
  internal: boolean;
  hiddenText: string;
}

/**
 * One technique or hero workshop: a portrait, a title, the takeaway and the places to learn more.
 */
@Component({
  selector: 'app-technique-tile',
  imports: [HeroImageFallbackDirective, RouterLink],
  templateUrl: './technique-tile.component.html',
  styleUrls: ['../../guide-article/guide-article.css', './technique-tile.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TechniqueTileComponent {
  readonly tile = input.required<TechniqueTile>();

  protected readonly links = computed<TileLink[]>(() => {
    const { title, links } = this.tile();

    return links.map((link) => {
      const internal = link.url.startsWith('/');

      const newTab = internal ? '' : ' (opens in a new tab)';

      return { ...link, internal, hiddenText: ` for ${title}${newTab}` };
    });
  });
}
