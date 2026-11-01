import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

const SIGN_IN_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled, so nothing changed. You can try again.',
  failed: 'Discord sign-in did not complete. Try again in a moment.',
};

const SIGN_IN_NOTICES: Record<string, string> = {
  deleted: 'Your account has been deleted and you are signed out.',
  reauth: 'For your safety, sign in again to delete your account. After that, go back to the delete section and try again.',
};

/** A path on this site. The server applies the same rule again before it redirects anywhere. */
function pathOnThisSite(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/account';
}

@Component({
  selector: 'app-sign-in-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './sign-in-page.component.html',
  styleUrl: './account-pages.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly next = pathOnThisSite(this.query.get('next'));

  readonly state = this.auth.state;
  readonly discordHref = `/api/auth/discord/start?next=${encodeURIComponent(this.next)}`;
  readonly error = computed(() => SIGN_IN_ERRORS[this.query.get('error') ?? ''] ?? null);
  readonly notice = computed(() => SIGN_IN_NOTICES[this.query.get('notice') ?? ''] ?? null);

  constructor() {
    void this.auth.load();

    effect(() => {
      if (this.state().status === 'signedIn' && this.query.get('notice') !== 'reauth') {
        void this.router.navigateByUrl(this.next);
      }
    });
  }
}
