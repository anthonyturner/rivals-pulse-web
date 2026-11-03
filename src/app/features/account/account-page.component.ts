import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DELETE_CONFIRMATION_PHRASE, isDeletionConfirmed } from '../../core/auth/account-deletion.types';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PlayerAvatarComponent } from '../../shared/components/player-avatar/player-avatar.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';

const SIGN_IN_AFTER_DELETE = {
  deleted: { notice: 'deleted' },
  signedOut: { next: '/account' },
  signInAgain: { next: '/account', notice: 'reauth' },
} as const;

const PROVIDER_LABELS: Record<string, string> = { discord: 'Discord', email: 'Email and password' };

@Component({
  selector: 'app-account-page',
  imports: [DatePipe, PageHeaderComponent, PlayerAvatarComponent, RouterLink, StatePanelComponent],
  templateUrl: './account-page.component.html',
  styleUrls: ['../learning/guides/guide-article/guide-article.css', './account-pages.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly account = computed(() => {
    const state = this.auth.state();

    return state.status === 'signedIn' ? state.account : null;
  });
  readonly method = computed(() => {
    const provider = this.account()?.provider ?? '';

    return PROVIDER_LABELS[provider] ?? provider;
  });

  readonly player = computed(() => {
    const state = this.auth.state();

    return state.status === 'signedIn' ? state.player : null;
  });
  readonly linkHeading = viewChild<ElementRef<HTMLElement>>('linkHeading');
  /**
   * The one live region on the page. What an action did, whether it worked or not, is read out here
   * and shown where it happened, so nothing else on the page is live and nothing is read twice.
   */
  readonly announcement = signal('');
  readonly linkCode = signal('');
  readonly linking = signal(false);
  readonly linkError = signal<string | null>(null);
  readonly canLink = computed(() => this.linkCode().trim().length > 0);
  readonly unlinking = signal(false);
  readonly unlinkError = signal<string | null>(null);

  readonly confirmationPhrase = DELETE_CONFIRMATION_PHRASE;
  readonly confirmation = signal('');
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly confirmed = computed(() => isDeletionConfirmed(this.confirmation()));

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  onLinkCodeInput(event: Event): void {
    this.linkCode.set((event.target as HTMLInputElement).value);
  }

  async linkPlayer(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.canLink() || this.linking()) {
      return;
    }

    this.linking.set(true);
    this.linkError.set(null);
    this.announcement.set('');

    const result = await this.auth.linkPlayer(this.linkCode());

    this.linking.set(false);

    switch (result.status) {
      case 'done':
        this.linkCode.set('');
        this.announceLinkChange(`Desktop app linked to ${this.player()?.name ?? 'your player'}.`);
        break;
      case 'signedOut':
        await this.router.navigate(['/sign-in'], { queryParams: { next: '/account' } });
        break;
      case 'failed':
        this.linkError.set(result.message);
        this.announcement.set(result.message);
        break;
    }
  }

  async unlinkPlayer(): Promise<void> {
    if (this.unlinking()) {
      return;
    }

    this.unlinking.set(true);
    this.unlinkError.set(null);
    this.announcement.set('');

    const result = await this.auth.unlinkPlayer();

    this.unlinking.set(false);

    switch (result.status) {
      case 'done':
        this.announceLinkChange('Desktop app unlinked.');
        break;
      case 'signedOut':
        await this.router.navigate(['/sign-in'], { queryParams: { next: '/account' } });
        break;
      case 'failed':
        this.unlinkError.set(result.message);
        this.announcement.set(result.message);
        break;
    }
  }

  /**
   * The focused button leaves the page when the link changes, so focus goes to the section heading
   * and the change is announced.
   */
  private announceLinkChange(message: string): void {
    this.announcement.set(message);
    this.linkHeading()?.nativeElement.focus();
  }

  onConfirmationInput(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.confirmed() || this.deleting()) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(null);
    this.announcement.set('');

    const result = await this.auth.deleteAccount({ mode: 'account', confirmation: this.confirmation() });

    if (result.status === 'failed') {
      this.deleting.set(false);
      this.deleteError.set(result.message);
      this.announcement.set(result.message);

      return;
    }

    await this.router.navigate(['/sign-in'], { queryParams: SIGN_IN_AFTER_DELETE[result.status] });
  }
}
