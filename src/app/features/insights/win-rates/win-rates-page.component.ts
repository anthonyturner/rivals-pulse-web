import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { HeroDataService } from '../../heroes/hero-data.service';
import { HeroStatsService } from '../hero-stats.service';
import { buildWinRatesView, type HeroIdentities } from './win-rates-view';

@Component({
  selector: 'app-win-rates-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './win-rates-page.component.html',
  styleUrl: './win-rates-page.component.css',
})
export class WinRatesPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly requestedSeason = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('season'))),
    { initialValue: this.route.snapshot.paramMap.get('season') },
  );
  // undefined while the request runs, null once it has failed.
  private readonly stats = toSignal(inject(HeroStatsService).getHeroStats());
  private readonly heroes = toSignal(inject(HeroDataService).getHeroes());
  private readonly identities = computed<HeroIdentities>(
    () =>
      new Map(
        (this.heroes() ?? []).map((hero) => [
          hero.id,
          { name: hero.name, role: hero.role, imageUrl: hero.imageUrl },
        ]),
      ),
  );

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  readonly loading = computed(() => this.stats() === undefined || this.heroes() === undefined);
  readonly failed = computed(() => this.stats() === null);
  readonly view = computed(() => {
    const stats = this.stats();

    return stats && !this.loading()
      ? buildWinRatesView(stats, this.requestedSeason(), this.identities())
      : null;
  });

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
