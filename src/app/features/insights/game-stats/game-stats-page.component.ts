import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { GameStatsComponent } from './game-stats.component';

@Component({
  selector: 'app-game-stats-page',
  imports: [GameStatsComponent, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-stats-page.component.html',
  styleUrl: '../insight-page.css',
})
export class GameStatsPageComponent {}
