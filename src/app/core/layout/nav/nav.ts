import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../../auth/auth.service';
import type { LinkedPlayer } from '../../auth/linked-player.types';
import { PlayerAvatarComponent } from '../../../shared/components/player-avatar/player-avatar.component';
import { ThemeToggle } from '../theme-toggle/theme-toggle';
import { ADMIN_PATH, HOME_NAV_ITEM, PRIMARY_NAV_ITEMS, PROFILE_PATH, activeNav } from './primary-nav';

interface AccountLink {
  label: string;
  path: string;
  /** Set when the visible label is a player's name, so "Account" is still announced. */
  ariaLabel: string | null;
  player: LinkedPlayer | null;
}

/** Where the links stop fitting on one row and become a menu. `nav.css` uses the same width. */
const WIDE_NAV_QUERY = '(min-width: 920px)';

@Component({
  selector: 'app-nav',
  imports: [PlayerAvatarComponent, RouterLink, ThemeToggle],
  templateUrl: './nav.html',
  styleUrl: './nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeMenuAndRestoreFocus()',
    '(document:click)': 'closeIfOutside($event)',
    '(focusout)': 'closeIfFocusLeft($event)',
  },
})
export class Nav {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');

  readonly isMenuOpen = signal(false);
  readonly homeItem = HOME_NAV_ITEM;
  readonly primaryNavItems = PRIMARY_NAV_ITEMS;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** The `aria-current` value of each link that belongs to the current URL, by link path. */
  readonly current = computed<Partial<Record<string, 'page' | 'true'>>>(() => {
    const active = activeNav(this.url());

    return active ? { [active.path]: active.exact ? 'page' : 'true' } : {};
  });

  /** Only for a signed-in visitor: the page is theirs, and a signed-out visitor has nothing to open. */
  readonly statsLink = computed(() => (this.auth.state().status === 'signedIn' ? PROFILE_PATH : null));

  /**
   * Only for an administrator. Hiding the link is a courtesy: the admin pages and API refuse
   * everyone else on their own.
   */
  readonly adminLink = computed(() => {
    const state = this.auth.state();

    return state.status === 'signedIn' && state.isAdmin ? ADMIN_PATH : null;
  });

  /** Null until the server has answered, so a signed-in visitor never sees "Sign in" flash by. */
  readonly accountLink = computed<AccountLink | null>(() => {
    const state = this.auth.state();

    switch (state.status) {
      case 'signedIn':
        return state.player
          ? {
              label: state.player.name,
              path: '/account',
              ariaLabel: `Account, ${state.player.name}`,
              player: state.player,
            }
          : { label: 'Account', path: '/account', ariaLabel: null, player: null };
      case 'signedOut':
      case 'unavailable':
        return { label: 'Sign in', path: '/sign-in', ariaLabel: null, player: null };
      default:
        return null;
    }
  });

  constructor() {
    void this.auth.load();

    effect(() => {
      this.url();
      untracked(() => this.closeMenu());
    });

    if (typeof matchMedia === 'function') {
      const wide = matchMedia(WIDE_NAV_QUERY);
      const onChange = (event: MediaQueryListEvent): void => {
        if (event.matches) {
          this.closeMenu();
        }
      };

      wide.addEventListener('change', onChange);
      inject(DestroyRef).onDestroy(() => wide.removeEventListener('change', onChange));
    }
  }

  toggleMenu(): void {
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected closeMenuAndRestoreFocus(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
      this.toggle().nativeElement.focus();
    }
  }

  protected closeIfOutside(event: Event): void {
    if (event.target instanceof Node && !this.host.contains(event.target)) {
      this.closeMenu();
    }
  }

  /** A null `relatedTarget` is a click on bare page or the browser's own chrome, which the other handlers cover. */
  protected closeIfFocusLeft(event: FocusEvent): void {
    if (event.relatedTarget instanceof Node && !this.host.contains(event.relatedTarget)) {
      this.closeMenu();
    }
  }
}
