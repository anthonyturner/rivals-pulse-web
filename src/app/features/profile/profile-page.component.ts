import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { AuthService, type DashboardResult } from '../../core/auth/auth.service';
import { NoticeComponent } from '../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PlayerAvatarComponent } from '../../shared/components/player-avatar/player-avatar.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';
import { CommunityHeroListComponent } from '../community/community-hero-list/community-hero-list.component';
import { HeroDataService } from '../heroes/hero-data.service';
import { heroIdentities } from '../insights/hero-identity';
import { ProfileFigureListComponent } from './figure-list/profile-figure-list.component';
import { buildProfileView, DEPTH_NOTE } from './profile-view';

/** The signed-in player's own stats, read from the matches their linked desktop app uploaded. */
@Component({
  selector: 'app-profile-page',
  imports: [
    CommunityHeroListComponent,
    NoticeComponent,
    PageHeaderComponent,
    PlayerAvatarComponent,
    ProfileFigureListComponent,
    RouterLink,
    StatePanelComponent,
  ],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  // undefined while the request runs.
  private readonly result = signal<DashboardResult | undefined>(undefined);
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  protected readonly depthNote = DEPTH_NOTE;
  protected readonly view = computed(() => {
    const roster = this.roster();

    return buildProfileView(this.result(), roster === undefined ? undefined : heroIdentities(roster));
  });

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.result.set(undefined);

    const result = await this.auth.loadDashboard();

    if (result.status === 'signedOut') {
      await this.router.navigate(['/sign-in'], { queryParams: { next: '/profile' } });

      return;
    }

    this.result.set(result);
  }
}
