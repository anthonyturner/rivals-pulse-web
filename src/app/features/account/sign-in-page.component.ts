import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { NoticeComponent } from '../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../shared/components/state-panel/state-panel.component';

const SIGN_IN_ERRORS: Record<string, string> = {
  cancelled: 'Sign-in was cancelled, so nothing changed. You can try again.',
  failed: 'Discord sign-in did not complete. Try again in a moment.',
};

const SIGN_IN_NOTICES: Record<string, string> = {
  deleted: 'Your account has been deleted and you are signed out.',
  reauth: 'Sign in again to delete your account, then return to the delete section.',
};

const SIGN_IN_UNAVAILABLE = 'We could not check whether you are signed in. You can still sign in.';
const ALREADY_SIGNED_IN = 'You are already signed in. Taking you on…';

/** The one message the page shows. */
interface PageMessage {
  kind: 'loading' | 'error' | 'notice';
  text: string;
}

/** A path on this site. The server applies the same rule again before it redirects anywhere. */
function pathOnThisSite(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') ? value : '/account';
}

@Component({
  selector: 'app-sign-in-page',
  imports: [NoticeComponent, PageHeaderComponent, RouterLink, StatePanelComponent],
  templateUrl: './sign-in-page.component.html',
  styleUrls: ['../learning/guides/guide-article/guide-article.css', './account-pages.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly query = inject(ActivatedRoute).snapshot.queryParamMap;
  private readonly next = pathOnThisSite(this.query.get('next'));

  readonly discordHref = `/api/auth/discord/start?next=${encodeURIComponent(this.next)}`;
  /** A signed-in visitor is sent on, unless they came here to sign in again before deleting. */
  readonly leaving = computed(
    () => this.auth.state().status === 'signedIn' && this.query.get('notice') !== 'reauth',
  );
  /** At most one message, so the page never announces two at once: a redirect, then an error from the address, a notice, then an unreadable session. */
  readonly message = computed<PageMessage | null>(() => {
    const error = SIGN_IN_ERRORS[this.query.get('error') ?? ''];
    const notice = SIGN_IN_NOTICES[this.query.get('notice') ?? ''];

    if (this.leaving()) {
      return { kind: 'loading', text: ALREADY_SIGNED_IN };
    }

    if (error) {
      return { kind: 'error', text: error };
    }

    if (notice) {
      return { kind: 'notice', text: notice };
    }

    return this.auth.state().status === 'unavailable' ? { kind: 'error', text: SIGN_IN_UNAVAILABLE } : null;
  });

  constructor() {
    void this.auth.load();

    effect(() => {
      if (this.leaving()) {
        void this.router.navigateByUrl(this.next);
      }
    });
  }
}
