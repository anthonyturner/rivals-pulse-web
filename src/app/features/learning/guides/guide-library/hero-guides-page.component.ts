import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { HubBentoComponent } from '../../../hub/hub-bento/hub-bento.component';
import { GUIDE_SECTIONS } from './guide-library.data';

@Component({
  selector: 'app-hero-guides-page',
  imports: [HubBentoComponent, PageHeaderComponent],
  templateUrl: './hero-guides-page.component.html',
  styleUrl: './hero-guides-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGuidesPageComponent {
  readonly sections = GUIDE_SECTIONS;
}
