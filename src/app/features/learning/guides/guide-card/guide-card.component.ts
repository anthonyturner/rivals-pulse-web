import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';

/**
 * A guide in a list: an optional small portrait, a caption, the title and a short blurb. The whole
 * card is one link named by the title. With no `imageUrl` there is no portrait column. `large` is
 * for lists with no group heading above them, where the card carries more. Pass `headingLevel` when
 * the title should be a heading in the page outline.
 */
@Component({
  selector: 'app-guide-card',
  imports: [HeroImageFallbackDirective, NgTemplateOutlet, RouterLink],
  templateUrl: './guide-card.component.html',
  styleUrl: './guide-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.large]': 'size() === "large"', '[class.plain]': '!imageUrl()' },
})
export class GuideCardComponent {
  readonly title = input.required<string>();
  readonly route = input.required<string | string[]>();
  readonly imageUrl = input<string | null>(null);
  readonly caption = input<string | null>(null);
  readonly blurb = input<string | null>(null);
  readonly size = input<'compact' | 'large'>('compact');
  readonly headingLevel = input<2 | 3 | null>(null);
}
