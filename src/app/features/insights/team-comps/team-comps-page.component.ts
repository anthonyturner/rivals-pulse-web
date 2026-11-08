import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { HeroDataService } from '../../heroes/hero-data.service';
import { heroIdentities } from '../hero-identity';
import { HeroSynergiesService } from '../hero-synergies.service';
import { buildTeamCompsView } from './team-comps-view';

@Component({
  selector: 'app-team-comps-page',
  imports: [HeroImageFallbackDirective, NoticeComponent, PageHeaderComponent, RouterLink, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-comps-page.component.html',
  styleUrls: ['../insight-page.css', './team-comps-page.component.css'],
})
export class TeamCompsPageComponent {
  // undefined while the request runs, null once it has failed.
  private readonly synergies = toSignal(inject(HeroSynergiesService).getHeroSynergies());
  private readonly roster = toSignal(inject(HeroDataService).getHeroRoster());

  /** Names, portraits and roles wait for the roster: without it no pair could be filed under a role. */
  readonly loading = computed(() => this.synergies() === undefined || this.roster() === undefined);
  readonly failed = computed(() => this.synergies() === null || this.roster() === null);
  readonly view = computed(() => {
    const synergies = this.synergies();
    const roster = this.roster();

    return synergies && roster ? buildTeamCompsView(synergies, heroIdentities(roster)) : null;
  });
  readonly meta = computed(() => this.view()?.metaParts.join(' · ') ?? '');
}
