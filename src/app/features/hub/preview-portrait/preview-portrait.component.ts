import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';

/** A hero's portrait at the site's list size. It is decoration: the tile's link carries the meaning. */
@Component({
  selector: 'app-preview-portrait',
  imports: [HeroImageFallbackDirective],
  templateUrl: './preview-portrait.component.html',
  styleUrl: './preview-portrait.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviewPortraitComponent {
  readonly src = input.required<string>();
}
