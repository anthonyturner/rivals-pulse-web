import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DELETE_CONFIRMATION_PHRASE, isDeletionConfirmed } from '../../core/auth/account-deletion.types';
import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

const SIGN_IN_AFTER_DELETE = {
  deleted: { notice: 'deleted' },
  signedOut: { next: '/account' },
  signInAgain: { next: '/account', notice: 'reauth' },
} as const;

const PROVIDER_LABELS: Record<string, string> = { discord: 'Discord', email: 'Email and password' };

@Component({
  selector: 'app-account-page',
  imports: [DatePipe, PageHeaderComponent, RouterLink],
  templateUrl: './account-page.component.html',
  styleUrl: './account-pages.css',
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

  readonly confirmationPhrase = DELETE_CONFIRMATION_PHRASE;
  readonly confirmation = signal('');
  readonly deleting = signal(false);
  readonly deleteError = signal<string | null>(null);
  readonly canDelete = computed(() => !this.deleting() && isDeletionConfirmed(this.confirmation()));

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }

  onConfirmationInput(event: Event): void {
    this.confirmation.set((event.target as HTMLInputElement).value);
  }

  async deleteAccount(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.canDelete()) {
      return;
    }

    this.deleting.set(true);
    this.deleteError.set(null);

    const result = await this.auth.deleteAccount({ mode: 'account', confirmation: this.confirmation() });

    if (result.status === 'failed') {
      this.deleting.set(false);
      this.deleteError.set(result.message);

      return;
    }

    await this.router.navigate(['/sign-in'], { queryParams: SIGN_IN_AFTER_DELETE[result.status] });
  }
}
