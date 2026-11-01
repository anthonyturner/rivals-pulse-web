import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type HomeBandTone = 'light' | 'white' | 'dark';

/**
 * One full-width band of the home page: the background for its tone, then a centred column with an
 * eyebrow, the band's h2 and an optional lede above whatever the band projects. Every band is a
 * labelled section, so the page's heading order and landmarks are decided here and nowhere else.
 */
@Component({
  selector: 'app-home-band',
  templateUrl: './home-band.component.html',
  styleUrl: './home-band.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeBandComponent {
  readonly tone = input<HomeBandTone>('light');
  readonly eyebrow = input('');
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
  readonly lede = input('');
}
