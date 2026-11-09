import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CommunityKills } from '../../../../contracts/community-kills.model';
import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { RosterHero } from '../../insights/hero-matchup-records';
import { HeroMatchupDetailComponent } from '../hero-matchup-detail/hero-matchup-detail.component';
import { buildHeadToHeadView } from '../hero-matchup-detail/hero-matchup-detail-view';
import { buildHeroCommunityCountersView } from './hero-community-counters-view';

/** How one hero fares against others in matches recorded by RivalsPulse players, or why there is nothing to show yet. */
@Component({
  selector: 'app-hero-community-counters',
  imports: [RouterLink, HeroMatchupDetailComponent],
  templateUrl: './hero-community-counters.component.html',
  styleUrl: './hero-community-counters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCommunityCountersComponent {
  readonly heroId = input.required<string>();
  readonly heroName = input.required<string>();
  /** `undefined` while loading, `null` when the matchups could not be read. */
  readonly matchups = input<HeroMatchups | null | undefined>(undefined);
  readonly roster = input<readonly RosterHero[]>([]);
  /** The overall hero figures a head-to-head compares against; optional, as is the kill feed. */
  readonly stats = input<HeroStats | null | undefined>(undefined);
  readonly kills = input<CommunityKills | null | undefined>(undefined);

  protected readonly view = computed(() =>
    buildHeroCommunityCountersView(this.matchups(), this.heroId(), this.heroName(), this.roster()),
  );

  /** The opponent whose head-to-head is open, kept with the page's hero so a new hero page closes it. */
  private readonly selected = signal<{ heroId: string; opponentId: string } | null>(null);
  private opener: HTMLElement | null = null;

  protected readonly headToHead = computed(() => {
    const selected = this.selected();
    const matchups = this.matchups();

    return selected === null || selected.heroId !== this.heroId() || !matchups
      ? null
      : buildHeadToHeadView(matchups, this.stats(), this.kills(), selected.heroId, selected.opponentId, this.roster());
  });

  protected openHeadToHead(opponentId: string, event: Event): void {
    this.opener = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.selected.set({ heroId: this.heroId(), opponentId });
  }

  protected closeHeadToHead(): void {
    this.selected.set(null);
    this.opener?.focus();
    this.opener = null;
  }
}
