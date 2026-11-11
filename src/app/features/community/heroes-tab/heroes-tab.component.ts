import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HeroDataService } from '../../heroes/hero-data.service';
import { CommunityFiguresService } from '../../insights/community-figures.service';
import { CurrentHeroStatsService } from '../../insights/current-hero-stats.service';
import { heroIdentities } from '../../insights/hero-identity';
import { CommunityHeroListComponent } from '../community-hero-list/community-hero-list.component';
import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { buildHeroFiguresView } from './hero-figures-view';
import { buildHeroesTabView } from './heroes-tab-view';

/** The most-picked and best-winning heroes from RivalsPulse uploads, or the reason there are none yet. */
@Component({
  selector: 'app-community-heroes-tab',
  imports: [CommunitySummaryComponent, CommunityHeroListComponent],
  templateUrl: './heroes-tab.component.html',
  styleUrl: './heroes-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroesTabComponent {
  // undefined while the request runs, null once it has failed.
  private readonly stats = toSignal(inject(CurrentHeroStatsService).getHeroStats());
  private readonly figures = toSignal(inject(CommunityFiguresService).getFigures());
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  protected readonly view = computed(() => {
    const roster = this.roster();

    return buildHeroesTabView(roster === undefined ? undefined : this.stats(), heroIdentities(roster ?? []));
  });

  protected readonly figuresView = computed(() => {
    const roster = this.roster();

    return buildHeroFiguresView(roster === undefined ? undefined : this.figures(), heroIdentities(roster ?? []));
  });

  protected readonly figuresFootnote =
    'Per minute played, to the nearest whole number, from Quick Match and Competitive. These are the figures of the players who upload their matches with RivalsPulse: each app only knows its own player, so they describe those players, not everyone in a lobby. Only heroes with enough lines are listed.';
  protected readonly link = { label: 'Browse the hero encyclopedia', path: '/heroes' };
  protected readonly secondLink = { label: 'See every hero win rate', path: '/win-rates' };
}
