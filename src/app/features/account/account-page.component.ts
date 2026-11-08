import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
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
  styleUrls: ['../../shared/styles/guide-article.css', './account-pages.css'],
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

  /** The saved setting. Unknown until it loads, and off for an account with no link. */
  readonly recordsOptIn = signal(false);
  readonly recordsOptInLoaded = signal(false);
  readonly recordsOptInSaving = signal(false);
  readonly recordsOptInError = signal<string | null>(null);
  readonly canChangeRecordsOptIn = computed(
    () => this.player() !== null && this.recordsOptInLoaded() && !this.recordsOptInSaving(),
  );
  /** Which load is current, so an answer for a link that has since changed is dropped. */
  private recordsOptInLoad = 0;

  readonly confirmationPhrase = DELETE_CONFIRMATION_PHRASE;
  readonly confirmation = signal('');
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly confirmed = computed(() => isDeletionConfirmed(this.confirmation()));

  constructor() {
    // The setting belongs to the link: it is off and fixed when there is none, and read again whenever the link changes.
    effect(() => {
      const linked = this.player() !== null;

      untracked(() => void this.loadRecordsOptIn(linked));
    });
  }

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

  private async loadRecordsOptIn(linked: boolean): Promise<void> {
    const load = ++this.recordsOptInLoad;

    this.recordsOptIn.set(false);
    this.recordsOptInError.set(null);
    this.recordsOptInLoaded.set(!linked);

    if (!linked) {
      return;
    }

    const result = await this.auth.loadRecordsOptIn();

    if (load !== this.recordsOptInLoad) {
      return;
    }

    switch (result.status) {
      case 'ready':
        this.recordsOptIn.set(result.showInRecords);
        this.recordsOptInLoaded.set(true);
        break;
      case 'signedOut':
        await this.router.navigate(['/sign-in'], { queryParams: { next: '/account' } });
        break;
      case 'failed':
        this.recordsOptInError.set(result.message);
        break;
    }
  }

  async onRecordsOptInChange(event: Event): Promise<void> {
    const box = event.target as HTMLInputElement;
    const show = box.checked;

    if (!this.canChangeRecordsOptIn()) {
      box.checked = this.recordsOptIn();

      return;
    }

    this.recordsOptInSaving.set(true);
    this.recordsOptInError.set(null);
    this.announcement.set('');

    const result = await this.auth.setRecordsOptIn(show);

    this.recordsOptInSaving.set(false);

    switch (result.status) {
      case 'ready':
        this.recordsOptIn.set(result.showInRecords);
        box.checked = result.showInRecords;
        this.announcement.set(
          result.showInRecords
            ? 'Show me in Pulse Records is on. Your name can appear on Pulse Records.'
            : 'Show me in Pulse Records is off. Your name is not shown on Pulse Records.',
        );
        break;
      case 'signedOut':
        await this.router.navigate(['/sign-in'], { queryParams: { next: '/account' } });
        break;
      case 'failed':
        // The box flipped under the player's finger; put it back to what is really saved.
        box.checked = this.recordsOptIn();
        this.recordsOptInError.set(result.message);
        this.announcement.set(result.message);
        break;
    }
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
