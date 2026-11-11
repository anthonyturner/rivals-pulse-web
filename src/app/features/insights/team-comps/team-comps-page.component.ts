import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { TeamCompsComponent } from './team-comps.component';

@Component({
  selector: 'app-team-comps-page',
  imports: [PageHeaderComponent, RouterLink, TeamCompsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-comps-page.component.html',
  styleUrls: ['../insight-page.css', './team-comps-page.component.css'],
})
export class TeamCompsPageComponent {}
