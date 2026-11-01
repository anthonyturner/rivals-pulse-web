import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type HomeBandTone = 'light' | 'white' | 'dark';
export type HomeBandAlign = 'start' | 'center';

/**
 * One full-width band of the home page: the background for its tone, then a centred column with
 * the band's h2 and an optional lede above whatever the band projects. Every band is a
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
  /**
   * Where the heading and lede sit; the projected content lays itself out. Not named
   * `align`: browsers read an `align="center"` attribute on any element as centred text.
   */
  readonly headAlign = input<HomeBandAlign>('start');
  readonly heading = input.required<string>();
  readonly headingId = input.required<string>();
  readonly lede = input('');
}
