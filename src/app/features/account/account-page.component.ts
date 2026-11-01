import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

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

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
