import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { AuthService, type DashboardResult } from '../../core/auth/auth.service';
import { NoticeComponent } from '../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PlayerAvatarComponent } from '../../shared/components/player-avatar/player-avatar.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';
import { CommunityHeroListComponent } from '../community/community-hero-list/community-hero-list.component';
import { HeroDataService } from '../heroes/hero-data.service';
import { HubTileComponent } from '../hub/hub-tile/hub-tile.component';
import { heroIdentities } from '../insights/hero-identity';
import { ProfileFigureListComponent } from './figure-list/profile-figure-list.component';
import { OwnActivityTablesComponent } from './own-activity/own-activity-tables.component';
import { profileLead } from './profile-lead';
import { buildProfileView, DEPTH_NOTE } from './profile-view';

/** The signed-in player's own stats, read from the matches their linked desktop app uploaded. */
@Component({
  selector: 'app-profile-page',
  imports: [
    CommunityHeroListComponent,
    HubTileComponent,
    NoticeComponent,
    OwnActivityTablesComponent,
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private destroyed = false;
  // undefined while the request runs.
  private readonly result = signal<DashboardResult | undefined>(undefined);
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  protected readonly depthNote = DEPTH_NOTE;
  private readonly identities = computed(() => {
    const roster = this.roster();

    return roster === undefined ? undefined : heroIdentities(roster);
  });

  protected readonly view = computed(() => buildProfileView(this.result(), this.identities()));
  protected readonly lead = computed(() => profileLead(this.result(), this.identities()));

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
    void this.load();
  }

  /**
   * Reads the stats. A retry replaces the button that was pressed, so it passes `restoreFocus` and
   * focus moves to the heading of whatever the answer is.
   */
  protected async load(restoreFocus = false): Promise<void> {
    this.result.set(undefined);

    const result = await this.auth.loadDashboard();

    if (this.destroyed) {
      return;
    }

    if (result.status === 'signedOut') {
      await this.router.navigate(['/sign-in'], { queryParams: { next: '/profile' } });

      return;
    }

    this.result.set(result);

    if (restoreFocus) {
      afterNextRender(() => this.focusHeading(), { injector: this.injector });
    }
  }

  private focusHeading(): void {
    const heading = this.host.nativeElement.querySelector<HTMLElement>('.player-name, app-state-panel h2');

    if (heading) {
      heading.tabIndex = -1;
      heading.focus();
    }
  }
}
