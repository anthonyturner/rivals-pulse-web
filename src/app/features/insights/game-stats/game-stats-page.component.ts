import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { buildGameStatsView } from './game-stats-view';
import { GameStatsService } from './game-stats.service';
import { SAVED_GAME_STATS } from './saved-game-stats';

const MILESTONES = [
  { value: '10M', label: 'Players in 72 hours' },
  { value: '20M', label: 'Players by December 17, 2024' },
  { value: '40M+', label: 'Players by February 2025 (NetEase, all platforms)' },
];

const SOURCES = [
  {
    label: 'Steam current-players API',
    url: 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=2767030',
  },
  { label: 'SteamDB', url: 'https://steamdb.info/app/2767030/charts/' },
  { label: 'Steam most played', url: 'https://store.steampowered.com/charts/mostplayed' },
  { label: 'Wikipedia (milestones)', url: 'https://en.wikipedia.org/wiki/Marvel_Rivals' },
];

@Component({
  selector: 'app-game-stats-page',
  imports: [NoticeComponent, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-stats-page.component.html',
  styleUrls: ['../insight-page.css', './game-stats-page.component.css'],
})
export class GameStatsPageComponent {
  // undefined while the request runs, null once it has failed.
  private readonly stats = toSignal(inject(GameStatsService).getGameStats());

  /** Null while the numbers load. */
  readonly view = computed(() => {
    const stats = this.stats();

    if (stats === undefined) {
      return null;
    }

    return stats === null ? buildGameStatsView(SAVED_GAME_STATS, true) : buildGameStatsView(stats, false);
  });
  readonly milestones = MILESTONES;
  readonly sources = SOURCES;
}
