import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/**
 * What the site's hero numbers count and leave out. It is written out here rather than read from
 * the stats response, so each sentence is checked against `src/hero-stats.ts` when it is edited.
 */
@Component({
  selector: 'app-how-we-count-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './how-we-count-page.component.html',
  styleUrl: './how-we-count-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowWeCountPageComponent {}
